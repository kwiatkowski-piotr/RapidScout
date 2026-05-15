import type { ExtractedIncident } from '../elasticsearch/incidents-payload.parser'

export type TimeSource = 'es_timestamp' | 'payload_time'

export type ProviderChartPoint = {
  provider: string
  timeEs: number
  timePayload: number
  incidentType?: number
  period?: number
  incidentKey: string
  messageProviderSeq: number
  name?: string
  kind?: string
  /** Wynik z payload.Values (np. "0:1") — etykieta osi X */
  scoreLabel?: string
}

export type ProviderChartSummary = {
  providers: string[]
  winsByProvider: Record<string, number>
  medianTimeByProvider: Record<string, number>
}

export type ProviderChartData = {
  points: ProviderChartPoint[]
  summaryEs: ProviderChartSummary
  summaryPayload: ProviderChartSummary
}

function timeForSource(
  point: ProviderChartPoint,
  source: TimeSource,
): number {
  return source === 'es_timestamp' ? point.timeEs : point.timePayload
}

export function incidentToChartPoint(incident: ExtractedIncident): ProviderChartPoint {
  return {
    provider: incident.provider ?? 'unknown',
    timeEs: incident.reportedAtEs ?? 0,
    timePayload: incident.reportedAtPayload ?? incident.reportedAtEs ?? 0,
    incidentType: incident.incidentType,
    period: incident.period,
    incidentKey: incident.incidentKey ?? '?:?',
    messageProviderSeq: incident.messageProviderSeq,
    name: typeof incident.name === 'string' ? incident.name : undefined,
    kind: typeof incident.kind === 'string' ? incident.kind : undefined,
    scoreLabel:
      typeof incident.scoreLabel === 'string' ? incident.scoreLabel : undefined,
  }
}

export function buildProviderChart(
  incidents: ExtractedIncident[],
): ProviderChartData {
  const points = incidents.map(incidentToChartPoint)

  return {
    points,
    summaryEs: summarizeProviderChart(points, 'es_timestamp'),
    summaryPayload: summarizeProviderChart(points, 'payload_time'),
  }
}

export function summarizeProviderChart(
  points: ProviderChartPoint[],
  timeSource: TimeSource,
): ProviderChartSummary {
  const providers = [...new Set(points.map((p) => p.provider))].sort()
  const winsByProvider: Record<string, number> = {}
  const timesByProvider = new Map<string, number[]>()

  for (const provider of providers) {
    winsByProvider[provider] = 0
    timesByProvider.set(provider, [])
  }

  const byKey = new Map<string, ProviderChartPoint[]>()
  for (const point of points) {
    const group = byKey.get(point.incidentKey) ?? []
    group.push(point)
    byKey.set(point.incidentKey, group)

    const bucket = timesByProvider.get(point.provider) ?? []
    bucket.push(timeForSource(point, timeSource))
    timesByProvider.set(point.provider, bucket)
  }

  for (const group of byKey.values()) {
    if (group.length === 0) continue
    const sorted = [...group].sort(
      (a, b) => timeForSource(a, timeSource) - timeForSource(b, timeSource),
    )
    const winner = sorted[0]?.provider
    if (winner) {
      winsByProvider[winner] = (winsByProvider[winner] ?? 0) + 1
    }
  }

  const medianTimeByProvider: Record<string, number> = {}
  for (const [provider, times] of timesByProvider) {
    if (times.length === 0) {
      medianTimeByProvider[provider] = 0
      continue
    }
    const sorted = [...times].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    medianTimeByProvider[provider] =
      sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
        : sorted[mid]!
  }

  return { providers, winsByProvider, medianTimeByProvider }
}

export function topProviderByWins(
  summary: ProviderChartSummary,
): { provider: string; wins: number } | undefined {
  let best: { provider: string; wins: number } | undefined
  for (const [provider, wins] of Object.entries(summary.winsByProvider)) {
    if (!best || wins > best.wins) {
      best = { provider, wins }
    }
  }
  return best
}
