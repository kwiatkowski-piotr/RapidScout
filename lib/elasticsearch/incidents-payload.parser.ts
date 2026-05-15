export type ExtractedIncident = {
  messageProviderSeq: number
  period?: number
  incidentType?: number
  seconds?: number
  participantPosition?: string
  [key: string]: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeIncident(
  raw: Record<string, unknown>,
  messageProviderSeq: number,
): ExtractedIncident {
  const incident: ExtractedIncident = {
    messageProviderSeq,
    ...raw,
  }

  if (typeof raw.Period === 'number') incident.period = raw.Period
  if (typeof raw.IncidentType === 'number') incident.incidentType = raw.IncidentType
  if (typeof raw.Seconds === 'number') incident.seconds = raw.Seconds
  if (typeof raw.ParticipantPosition === 'string') {
    incident.participantPosition = raw.ParticipantPosition
  }

  return incident
}

function collectFromPeriods(
  payload: Record<string, unknown>,
  messageProviderSeq: number,
): ExtractedIncident[] {
  const livescore = payload.Livescore
  if (!isRecord(livescore)) return []

  const periods = livescore.Periods
  if (!Array.isArray(periods)) return []

  const incidents: ExtractedIncident[] = []
  for (const period of periods) {
    if (!isRecord(period)) continue
    const periodIncidents = period.Incidents
    if (!Array.isArray(periodIncidents)) continue
    for (const item of periodIncidents) {
      if (isRecord(item)) {
        incidents.push(normalizeIncident(item, messageProviderSeq))
      }
    }
  }
  return incidents
}

function collectFromTopLevel(
  payload: Record<string, unknown>,
  messageProviderSeq: number,
): ExtractedIncident[] {
  const topLevel = payload.Incidents
  if (!Array.isArray(topLevel)) return []

  return topLevel
    .filter(isRecord)
    .map((item) => normalizeIncident(item, messageProviderSeq))
}

export function extractIncidentsFromPayload(
  payload: unknown,
  messageProviderSeq: number,
): ExtractedIncident[] {
  if (!isRecord(payload)) return []

  const fromPeriods = collectFromPeriods(payload, messageProviderSeq)
  if (fromPeriods.length > 0) return fromPeriods

  return collectFromTopLevel(payload, messageProviderSeq)
}

export function summarizeIncidentTypes(
  incidents: ExtractedIncident[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const incident of incidents) {
    const key =
      incident.incidentType !== undefined
        ? String(incident.incidentType)
        : 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}
