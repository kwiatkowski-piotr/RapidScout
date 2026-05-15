import {
  extractPayloadTimeMs,
  extractProviderFromPayload,
} from '../analysis/payload-provider'
import { lsiOccurrenceTieBreak, formatValuesAsScoreLabel } from '../analysis/lsi-values-label'

export type IncidentExtractionContext = {
  messageProviderSeq: number
  reportedAtEs: number
  messageProvider?: string
  headers?: Record<string, unknown>
}

export type ExtractedIncident = {
  messageProviderSeq: number
  period?: number
  incidentType?: number
  seconds?: number
  participantPosition?: string
  provider?: string
  reportedAtEs?: number
  reportedAtPayload?: number
  incidentKey?: string
  [key: string]: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function buildIncidentKey(incident: {
  incidentType?: number
  period?: number
  participantPosition?: string
}): string {
  const type = incident.incidentType ?? '?'
  const period = incident.period ?? '?'
  const position = incident.participantPosition
  return position ? `${type}:${period}:${position}` : `${type}:${period}`
}

function resolveProvider(
  raw: Record<string, unknown>,
  payload: Record<string, unknown>,
  ctx: IncidentExtractionContext,
): string {
  return (
    extractProviderFromPayload(payload, raw) ??
    ctx.messageProvider ??
    'unknown'
  )
}

function normalizeIncident(
  raw: Record<string, unknown>,
  payload: Record<string, unknown>,
  ctx: IncidentExtractionContext,
): ExtractedIncident {
  const incident: ExtractedIncident = {
    messageProviderSeq: ctx.messageProviderSeq,
    reportedAtEs: ctx.reportedAtEs,
    ...raw,
  }

  if (typeof raw.Period === 'number') incident.period = raw.Period
  if (typeof raw.IncidentType === 'number') incident.incidentType = raw.IncidentType
  if (typeof raw.Seconds === 'number') incident.seconds = raw.Seconds
  if (typeof raw.ParticipantPosition === 'string') {
    incident.participantPosition = raw.ParticipantPosition
  }

  incident.provider = resolveProvider(raw, payload, ctx)
  incident.reportedAtPayload =
    extractPayloadTimeMs(payload, raw) ?? ctx.reportedAtEs
  incident.incidentKey = buildIncidentKey(incident)

  return incident
}

function collectFromPeriods(
  payload: Record<string, unknown>,
  ctx: IncidentExtractionContext,
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
        incidents.push(normalizeIncident(item, payload, ctx))
      }
    }
  }
  return incidents
}

function collectFromTopLevel(
  payload: Record<string, unknown>,
  ctx: IncidentExtractionContext,
): ExtractedIncident[] {
  const topLevel = payload.Incidents
  if (!Array.isArray(topLevel)) return []

  return topLevel
    .filter(isRecord)
    .map((item) => normalizeIncident(item, payload, ctx))
}

/** LSI Incidents.Extracted: one Kafka message = one event (Provider, Name, Kind, Id, Period). */
function isLsiExtractedMessage(payload: Record<string, unknown>): boolean {
  if (isRecord(payload.Livescore)) return false
  const hasProvider =
    isRecord(payload.Provider) ||
    typeof payload.ProviderId === 'number' ||
    typeof payload.ProviderId === 'string'
  const hasEventMeta =
    typeof payload.Name === 'string' ||
    typeof payload.Kind === 'string' ||
    typeof payload.Id === 'number'
  return hasProvider && hasEventMeta
}

function periodIdFromPayload(payload: Record<string, unknown>): number | undefined {
  const period = payload.Period
  if (isRecord(period) && typeof period.Id === 'number') return period.Id
  if (typeof payload.Period === 'number') return payload.Period
  return undefined
}

function collectFromLsiMessage(
  payload: Record<string, unknown>,
  ctx: IncidentExtractionContext,
): ExtractedIncident[] {
  if (!isLsiExtractedMessage(payload)) return []

  const incidentType =
    typeof payload.Id === 'number' ? payload.Id : undefined
  const period = periodIdFromPayload(payload)
  const name = typeof payload.Name === 'string' ? payload.Name : undefined
  const kind = typeof payload.Kind === 'string' ? payload.Kind : undefined

  const scoreLabel = formatValuesAsScoreLabel(payload)
  const tieBreak = lsiOccurrenceTieBreak(payload, ctx.reportedAtEs)

  const incident: ExtractedIncident = {
    messageProviderSeq: ctx.messageProviderSeq,
    reportedAtEs: ctx.reportedAtEs,
    period,
    incidentType,
    provider: resolveProvider(payload, payload, ctx),
    reportedAtPayload: extractPayloadTimeMs(payload, payload) ?? ctx.reportedAtEs,
    name,
    kind,
    status: payload.Status,
    scoreLabel,
  }

  incident.incidentKey = `${incidentType ?? '?'}:${period ?? '?'}:${name ?? '?'}:${tieBreak}`

  return [incident]
}

export function extractIncidentsWithContext(
  payload: unknown,
  ctx: IncidentExtractionContext,
): ExtractedIncident[] {
  if (!isRecord(payload)) return []

  const fromPeriods = collectFromPeriods(payload, ctx)
  if (fromPeriods.length > 0) return fromPeriods

  const fromTopLevel = collectFromTopLevel(payload, ctx)
  if (fromTopLevel.length > 0) return fromTopLevel

  return collectFromLsiMessage(payload, ctx)
}

export function extractIncidentsFromPayload(
  payload: unknown,
  messageProviderSeq: number,
  options?: Partial<IncidentExtractionContext>,
): ExtractedIncident[] {
  return extractIncidentsWithContext(payload, {
    messageProviderSeq,
    reportedAtEs: options?.reportedAtEs ?? 0,
    messageProvider: options?.messageProvider,
    headers: options?.headers,
  })
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
