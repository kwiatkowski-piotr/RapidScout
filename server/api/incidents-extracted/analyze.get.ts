import { DateTime } from 'luxon'
import { z } from 'zod'

import {
  buildLsportsKafkaIndex,
  DEFAULT_MAX_RESULTS,
  HARD_MAX_RESULTS,
  INCIDENTS_EXTRACTED_TOPIC,
} from '@lib/consts'
import { getIncidentsExtractedMessages } from '@lib/elasticsearch/incidents-extracted-messages'
import { buildProviderChart } from '@lib/analysis/provider-chart'
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
  })
  .refine((data) => data.timestampTo > data.timestampFrom, {
    message: 'timestampTo must be after timestampFrom',
    path: ['timestampTo'],
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

  let hits
  try {
    hits = await getIncidentsExtractedMessages(es, {
      index,
      eventId,
      timestampFrom,
      timestampTo,
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

  const messages = hits.map((hit) => {
    const source = hit._source as MessageDocument
    return {
      providerSeq: source.providerSeq,
      timestamp: formatTimestampForUi(source['@timestamp']),
      topic: source.topic,
    }
  })

  const incidents = hits.flatMap((hit) => {
    const source = hit._source as MessageDocument
    const payload = parseRawPayload(source.rawPayload)
    return extractIncidentsWithContext(payload, {
      messageProviderSeq: source.providerSeq,
      reportedAtEs: source['@timestamp'],
      messageProvider: source.provider,
      headers: source.headers,
    })
  })

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
