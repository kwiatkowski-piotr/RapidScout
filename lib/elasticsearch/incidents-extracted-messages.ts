import type { Client } from '@elastic/elasticsearch'
import type { SearchHit } from '@elastic/elasticsearch/lib/api/types'

import {
  ES_PAGE_SIZE,
  ES_REQUEST_TIMEOUT_MS,
  INCIDENTS_EXTRACTED_TOPIC,
} from '../consts'
import type { MessageDocument } from '../types/message-document'
import { isoToEpochMs } from './timestamp-range'

export type GetIncidentsExtractedParams = {
  index: string
  eventId: string
  topic?: typeof INCIDENTS_EXTRACTED_TOPIC
  timestampFrom: string
  timestampTo: string
  maxResults?: number
}

export type IncidentsExtractedHit = SearchHit<MessageDocument>

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
          must: [
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
          ],
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
