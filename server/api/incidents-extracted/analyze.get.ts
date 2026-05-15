import { DateTime } from 'luxon'
import { z } from 'zod'

import {
  buildLsportsKafkaIndex,
  DEFAULT_MAX_RESULTS,
  HARD_MAX_RESULTS,
  INCIDENTS_EXTRACTED_TOPIC,
  INCIDENT_TIME_CLUSTER_GAP_MS,
} from '@lib/consts'
import { applyIncidentTimeClustering } from '@lib/analysis/incident-time-cluster'
import { buildProviderChart } from '@lib/analysis/provider-chart'
import { decodeAnalyzeCursor, encodeAnalyzeCursor } from '@lib/elasticsearch/analyze-cursor'
import {
  getIncidentsExtractedMessages,
  getIncidentsExtractedWindow,
  type IncidentsExtractedHit,
} from '@lib/elasticsearch/incidents-extracted-messages'
import {
  extractIncidentsWithContext,
  summarizeIncidentTypes,
} from '@lib/elasticsearch/incidents-payload.parser'
import type { MessageDocument } from '@lib/types/message-document'

import { getElasticClient } from '../../plugins/02.elastic-client.plugin'

const QuerySchema = z
  .object({
    eventId: z.string().min(1).regex(/^\d+$/, 'eventId must be numeric'),
    timestampFrom: z.string().min(1),
    timestampTo: z.string().min(1),
    environment: z.enum(['beta', 'production']).default('production'),
    maxResults: z.coerce.number().int().positive().optional(),
    payloadNames: z.string().optional(),
    cursor: z.string().optional(),
    pageSize: z.coerce.number().int().min(100).max(10_000).optional(),
  })
  .refine((data) => data.timestampTo > data.timestampFrom, {
    message: 'timestampTo must be after timestampFrom',
    path: ['timestampTo'],
  })
  .refine((data) => !data.cursor || data.pageSize, {
    message: 'cursor requires pageSize',
    path: ['pageSize'],
  })

function formatTimestampForUi(timestamp: number): string {
  const dateTime = DateTime.fromMillis(timestamp)
  return (
    dateTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS, {
      locale: 'pl',
    }) + `.${dateTime.get('millisecond')}`
  )
}

function parseRawPayload(rawPayload: string): unknown {
  try {
    return JSON.parse(rawPayload) as unknown
  } catch {
    return { _parseError: true, raw: rawPayload }
  }
}

function parsePayloadNames(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function hitsToMessages(hits: IncidentsExtractedHit[]) {
  return hits.map((hit) => {
    const source = hit._source as MessageDocument
    return {
      providerSeq: source.providerSeq,
      timestamp: formatTimestampForUi(source['@timestamp']),
      topic: source.topic,
    }
  })
}

function hitsToIncidents(hits: IncidentsExtractedHit[]) {
  return hits.flatMap((hit) => {
    const source = hit._source as MessageDocument
    const payload = parseRawPayload(source.rawPayload)
    return extractIncidentsWithContext(payload, {
      messageProviderSeq: source.providerSeq,
      reportedAtEs: source['@timestamp'],
      messageProvider: source.provider,
      headers: source.headers,
    })
  })
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = QuerySchema.safeParse(query)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: parsed.error.flatten(),
    })
  }

  const { eventId, timestampFrom, timestampTo, environment } = parsed.data
  const maxResults = Math.min(
    parsed.data.maxResults ?? DEFAULT_MAX_RESULTS,
    HARD_MAX_RESULTS,
  )
  const index = buildLsportsKafkaIndex(environment)
  const payloadNamesList = parsePayloadNames(parsed.data.payloadNames)
  const pageSize = parsed.data.pageSize
  const cursorStr = parsed.data.cursor
  const isPageMode = Boolean(pageSize)

  let es
  try {
    es = await getElasticClient()
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Elasticsearch unavailable'
    throw createError({
      statusCode: 502,
      statusMessage: detail,
    })
  }

  const baseParams = {
    index,
    eventId,
    timestampFrom,
    timestampTo,
    ...(payloadNamesList.length ? { payloadNames: payloadNamesList } : {}),
  }

  let hits: IncidentsExtractedHit[]

  try {
    if (isPageMode) {
      let searchAfter: unknown[] | undefined
      try {
        searchAfter = cursorStr ? decodeAnalyzeCursor(cursorStr) : undefined
      } catch {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid cursor',
        })
      }
      const { hits: pageHits, nextSearchAfter } = await getIncidentsExtractedWindow(
        es,
        baseParams,
        pageSize,
        searchAfter,
      )
      hits = pageHits

      const messages = hitsToMessages(hits)
      const incidents = hitsToIncidents(hits)
      incidents.sort((a, b) => {
        const seqDiff = a.messageProviderSeq - b.messageProviderSeq
        if (seqDiff !== 0) return seqDiff
        return (a.seconds ?? 0) - (b.seconds ?? 0)
      })

      const nextCursor =
        hits.length === pageSize && nextSearchAfter?.length
          ? encodeAnalyzeCursor(nextSearchAfter)
          : null

      return {
        meta: {
          eventId,
          topic: INCIDENTS_EXTRACTED_TOPIC,
          index,
          timestampFrom,
          timestampTo,
          messageCount: messages.length,
          truncated: false,
          pageMode: true,
          nextCursor,
          pageSize,
          payloadNamesFilter: payloadNamesList,
        },
        messages,
        analysis: {
          incidents,
          summary: {
            messagesCount: messages.length,
            incidentsCount: incidents.length,
            incidentTypes: summarizeIncidentTypes(incidents),
          },
          providerChart: undefined,
        },
      }
    }

    hits = await getIncidentsExtractedMessages(es, {
      ...baseParams,
      maxResults,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Elasticsearch query failed'
    const isTimeout =
      message.toLowerCase().includes('timeout') ||
      (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'TimeoutError')

    throw createError({
      statusCode: isTimeout ? 504 : 502,
      statusMessage: message,
    })
  }

  const messages = hitsToMessages(hits)
  const incidents = hitsToIncidents(hits)

  applyIncidentTimeClustering(incidents, INCIDENT_TIME_CLUSTER_GAP_MS)

  incidents.sort((a, b) => {
    const seqDiff = a.messageProviderSeq - b.messageProviderSeq
    if (seqDiff !== 0) return seqDiff
    return (a.seconds ?? 0) - (b.seconds ?? 0)
  })

  return {
    meta: {
      eventId,
      topic: INCIDENTS_EXTRACTED_TOPIC,
      index,
      timestampFrom,
      timestampTo,
      messageCount: messages.length,
      truncated: messages.length >= maxResults,
      pageMode: false,
      nextCursor: null,
      payloadNamesFilter: payloadNamesList,
    },
    messages,
    analysis: {
      incidents,
      summary: {
        messagesCount: messages.length,
        incidentsCount: incidents.length,
        incidentTypes: summarizeIncidentTypes(incidents),
      },
      providerChart: buildProviderChart(incidents),
    },
  }
})
