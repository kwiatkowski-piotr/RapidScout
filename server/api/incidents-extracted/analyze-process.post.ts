import { z } from 'zod'

import { INCIDENT_TIME_CLUSTER_GAP_MS } from '@lib/consts'
import { applyIncidentTimeClustering } from '@lib/analysis/incident-time-cluster'
import { buildProviderChart } from '@lib/analysis/provider-chart'
import type { ExtractedIncident } from '@lib/elasticsearch/incidents-payload.parser'
import { summarizeIncidentTypes } from '@lib/elasticsearch/incidents-payload.parser'

const BodySchema = z.object({
  incidents: z.array(z.record(z.unknown())).min(1),
  messagesCount: z.coerce.number().int().min(0).optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = BodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: parsed.error.flatten(),
    })
  }

  const incidents = parsed.data.incidents as ExtractedIncident[]
  const messagesCount = parsed.data.messagesCount ?? 0

  applyIncidentTimeClustering(incidents, INCIDENT_TIME_CLUSTER_GAP_MS)

  incidents.sort((a, b) => {
    const seqDiff = a.messageProviderSeq - b.messageProviderSeq
    if (seqDiff !== 0) return seqDiff
    return (a.seconds ?? 0) - (b.seconds ?? 0)
  })

  return {
    analysis: {
      incidents,
      summary: {
        messagesCount,
        incidentsCount: incidents.length,
        incidentTypes: summarizeIncidentTypes(incidents),
      },
      providerChart: buildProviderChart(incidents),
    },
  }
})
