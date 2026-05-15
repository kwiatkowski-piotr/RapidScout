import type { Client } from '@elastic/elasticsearch'
import type { SearchHit } from '@elastic/elasticsearch/lib/api/types'

import {
  ES_PAGE_SIZE,
  ES_REQUEST_TIMEOUT_MS,
  INCIDENTS_EXTRACTED_TOPIC,
} from '../consts'
import type { MessageDocument } from '../types/message-document'
import { buildRawPayloadNameFilter } from './raw-payload-name-filter'
import { isoToEpochMs } from './timestamp-range'

export type GetIncidentsExtractedParams = {
  index: string
  eventId: string
  topic?: typeof INCIDENTS_EXTRACTED_TOPIC
  timestampFrom: string
  timestampTo: string
  maxResults?: number
  /** Filtr `match_phrase` na `rawPayload` — nazwy LSI (`Name`), np. Score, YellowCard */
  payloadNames?: string[]
}

export type IncidentsExtractedHit = SearchHit<MessageDocument>

function buildMustClauses(
  params: GetIncidentsExtractedParams,
  topic: string,
  timestampGte: number,
  timestampLt: number,
): object[] {
  const must: object[] = [
    { term: { eventId: { value: params.eventId } } },
    { term: { topic: { value: topic } } },
    {
      range: {
        '@timestamp': {
          gte: timestampGte,
          lt: timestampLt,
        },
      },
    },
  ]

  if (params.payloadNames?.length) {
    must.push(buildRawPayloadNameFilter(params.payloadNames))
  }

  return must
}

export async function getIncidentsExtractedMessages(
  es: Client,
  params: GetIncidentsExtractedParams,
): Promise<IncidentsExtractedHit[]> {
  const topic = params.topic ?? INCIDENTS_EXTRACTED_TOPIC
  const maxResults = params.maxResults ?? 10_000
  const timestampGte = isoToEpochMs(params.timestampFrom)
  const timestampLt = isoToEpochMs(params.timestampTo)

  const hits: IncidentsExtractedHit[] = []
  let searchAfter: unknown[] | undefined

  while (hits.length < maxResults) {
    const pageSize = Math.min(ES_PAGE_SIZE, maxResults - hits.length)

    const searchResult = await es.search<MessageDocument>({
      index: params.index,
      timeout: `${Math.floor(ES_REQUEST_TIMEOUT_MS / 1000)}s`,
      query: {
        bool: {
          must: buildMustClauses(params, topic, timestampGte, timestampLt),
        },
      },
      sort: [{ providerSeq: 'asc' }],
      size: pageSize,
      ...(searchAfter ? { search_after: searchAfter } : {}),
    })

    const pageHits = searchResult.hits.hits as IncidentsExtractedHit[]
    if (pageHits.length === 0) break

    hits.push(...pageHits)

    const lastHit = pageHits[pageHits.length - 1]
    if (!lastHit.sort?.length) break
    searchAfter = lastHit.sort
  }

  return hits
}

export type IncidentsExtractedPage = {
  hits: IncidentsExtractedHit[]
  /** Wartość `sort` ostatniego hitu — zakoduj jako cursor dla kolejnej strony */
  nextSearchAfter: unknown[] | null
}

/**
 * Jedna strona wyników (jedno wywołanie `search` z `search_after`).
 */
export async function getIncidentsExtractedPage(
  es: Client,
  params: GetIncidentsExtractedParams,
  size: number,
  searchAfter?: unknown[],
): Promise<IncidentsExtractedPage> {
  const topic = params.topic ?? INCIDENTS_EXTRACTED_TOPIC
  const timestampGte = isoToEpochMs(params.timestampFrom)
  const timestampLt = isoToEpochMs(params.timestampTo)
  const take = Math.min(Math.max(1, size), ES_PAGE_SIZE)

  const searchResult = await es.search<MessageDocument>({
    index: params.index,
    timeout: `${Math.floor(ES_REQUEST_TIMEOUT_MS / 1000)}s`,
    query: {
      bool: {
        must: buildMustClauses(params, topic, timestampGte, timestampLt),
      },
    },
    sort: [{ providerSeq: 'asc' }],
    size: take,
    ...(searchAfter?.length ? { search_after: searchAfter } : {}),
  })

  const pageHits = searchResult.hits.hits as IncidentsExtractedHit[]
  const last = pageHits[pageHits.length - 1]
  const nextSearchAfter =
    pageHits.length > 0 && last?.sort?.length ? (last.sort as unknown[]) : null

  return { hits: pageHits, nextSearchAfter }
}

/**
 * Zbiera do `windowSize` hitów, wykonując po `ES_PAGE_SIZE` (limit pojedynczego `search` w ES).
 * Zwraca `nextSearchAfter` ostatniego hitu tylko gdy okno jest pełne — wtedy klient może podać je jako kursor.
 */
export async function getIncidentsExtractedWindow(
  es: Client,
  params: GetIncidentsExtractedParams,
  windowSize: number,
  searchAfter?: unknown[],
): Promise<{ hits: IncidentsExtractedHit[]; nextSearchAfter: unknown[] | null }> {
  const cap = Math.min(Math.max(1, windowSize), 10_000)
  const hits: IncidentsExtractedHit[] = []
  let sa = searchAfter?.length ? searchAfter : undefined

  while (hits.length < cap) {
    const remaining = cap - hits.length
    const chunk = Math.min(ES_PAGE_SIZE, remaining)
    const { hits: pageHits, nextSearchAfter } = await getIncidentsExtractedPage(
      es,
      params,
      chunk,
      sa,
    )

    if (pageHits.length === 0) {
      return { hits, nextSearchAfter: null }
    }

    hits.push(...pageHits)

    if (pageHits.length < chunk) {
      return { hits, nextSearchAfter: null }
    }

    if (!nextSearchAfter?.length) {
      return { hits, nextSearchAfter: null }
    }

    sa = nextSearchAfter

    if (hits.length === cap) {
      const last = hits[hits.length - 1]
      return {
        hits,
        nextSearchAfter: last?.sort?.length ? (last.sort as unknown[]) : null,
      }
    }
  }

  return { hits, nextSearchAfter: null }
}
