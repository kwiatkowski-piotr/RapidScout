import { z } from 'zod'

import { buildLsportsKafkaIndex } from '@lib/consts'
import { getMessagePayload } from '@lib/elasticsearch/get-message-payload'

import { getElasticClient } from '../../plugins/02.elastic-client.plugin'

const QuerySchema = z.object({
  eventId: z.string().min(1).regex(/^\d+$/, 'eventId must be numeric'),
  providerSeq: z.coerce.number().int().nonnegative(),
  timestampFrom: z.string().min(1),
  timestampTo: z.string().min(1),
  environment: z.enum(['beta', 'production']).default('production'),
})

export default defineEventHandler(async (event) => {
  const parsed = QuerySchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: parsed.error.flatten(),
    })
  }

  const { eventId, providerSeq, timestampFrom, timestampTo, environment } =
    parsed.data

  let es
  try {
    es = await getElasticClient()
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Elasticsearch unavailable'
    throw createError({ statusCode: 502, statusMessage: detail })
  }

  try {
    const rawPayload = await getMessagePayload(es, {
      index: buildLsportsKafkaIndex(environment),
      eventId,
      providerSeq,
      timestampFrom,
      timestampTo,
    })
    return { providerSeq, rawPayload }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payload fetch failed'
    throw createError({ statusCode: 404, statusMessage: message })
  }
})
