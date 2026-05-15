import type { Client } from '@elastic/elasticsearch'

import { INCIDENTS_EXTRACTED_TOPIC } from '../consts'
import type { MessageDocument } from '../types/message-document'
import { isoToEpochMs } from './timestamp-range'

export type GetMessagePayloadParams = {
  index: string
  eventId: string
  providerSeq: number
  timestampFrom: string
  timestampTo: string
  topic?: typeof INCIDENTS_EXTRACTED_TOPIC
}

export async function getMessagePayload(
  es: Client,
  params: GetMessagePayloadParams,
): Promise<unknown> {
  const topic = params.topic ?? INCIDENTS_EXTRACTED_TOPIC

  const searchResult = await es.search<MessageDocument>({
    index: params.index,
    size: 1,
    timeout: '30s',
    query: {
      bool: {
        must: [
          { term: { eventId: { value: params.eventId } } },
          { term: { topic: { value: topic } } },
          { term: { providerSeq: { value: params.providerSeq } } },
          {
            range: {
              '@timestamp': {
                gte: isoToEpochMs(params.timestampFrom),
                lt: isoToEpochMs(params.timestampTo),
              },
            },
          },
        ],
      },
    },
  })

  const hit = searchResult.hits.hits[0]?._source
  if (!hit?.rawPayload) {
    throw new Error(`Message providerSeq=${params.providerSeq} not found`)
  }

  try {
    return JSON.parse(hit.rawPayload) as unknown
  } catch {
    return { _parseError: true, raw: hit.rawPayload }
  }
}
