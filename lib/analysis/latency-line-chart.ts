import { providerIdChartLabel } from './provider-labels'
import type { ProviderChartPoint, TimeSource } from './provider-chart'

const LOG_MIN_SEC = 0.0001

export type LatencyLineDataset = {
  label: string
  data: (number | null)[]
  borderColor: string
  backgroundColor: string
  borderDash?: number[]
  pointStyle?: string | string[]
  spanGaps?: boolean
}

export type LatencyLineChartModel = {
  labels: string[]
  datasets: LatencyLineDataset[]
  /** Per X index: meta for tooltips */
  columns: Array<{
    incidentKey: string
    winnerProvider: string
    minTimeMs: number
    xLabel: string
  }>
}

function timeMs(point: ProviderChartPoint, source: TimeSource): number {
  return source === 'es_timestamp' ? point.timeEs : point.timePayload
}

function xLabelForPoint(point: ProviderChartPoint): string {
  const name = point.name ?? `Id${point.incidentType ?? '?'}`
  const sl = point.scoreLabel
  if (sl) return `${name} ${sl}`
  return name
}

export function buildLatencyLineChart(
  points: ProviderChartPoint[],
  timeSource: TimeSource,
  nameQuickFilter: string | null,
): LatencyLineChartModel {
  const filtered =
    nameQuickFilter === null || nameQuickFilter === ''
      ? points
      : points.filter(
          (p) =>
            (p.name ?? '').toLowerCase() === nameQuickFilter.toLowerCase(),
        )

  const byKey = new Map<string, ProviderChartPoint[]>()
  for (const p of filtered) {
    const list = byKey.get(p.incidentKey) ?? []
    list.push(p)
    byKey.set(p.incidentKey, list)
  }

  type Group = {
    key: string
    points: ProviderChartPoint[]
    minTimeMs: number
    winnerProvider: string
    xLabel: string
  }

  const groups: Group[] = []
  for (const [key, pts] of byKey) {
    if (pts.length === 0) continue
    const minTimeMs = Math.min(...pts.map((p) => timeMs(p, timeSource)))
    const sorted = [...pts].sort(
      (a, b) => timeMs(a, timeSource) - timeMs(b, timeSource),
    )
    const winnerProvider = sorted[0]?.provider ?? '?'
    const xLabel = xLabelForPoint(sorted[0]!)
    groups.push({
      key,
      points: pts,
      minTimeMs,
      winnerProvider,
      xLabel,
    })
  }

  groups.sort((a, b) => a.minTimeMs - b.minTimeMs)

  const labels = groups.map((g) => g.xLabel)
  const columns = groups.map((g) => ({
    incidentKey: g.key,
    winnerProvider: g.winnerProvider,
    minTimeMs: g.minTimeMs,
    xLabel: g.xLabel,
  }))

  const providers = [...new Set(filtered.map((p) => p.provider))].sort()

  const DASHES: number[][] = [[], [6, 4], [2, 2], [4, 2, 1, 2], [8, 3]]
  const POINT_STYLES = [
    'circle',
    'rect',
    'triangle',
    'rectRot',
    'cross',
    'star',
    'dash',
  ] as const

  const COLORS = [
    '#60a5fa',
    '#f87171',
    '#4ade80',
    '#c084fc',
    '#fbbf24',
    '#fb923c',
    '#22d3ee',
    '#f472b6',
  ]

  const datasets: LatencyLineDataset[] = providers.map((provider, index) => {
    const data = groups.map((group) => {
      const mine = group.points.filter((p) => p.provider === provider)
      if (mine.length === 0) return null
      const t = Math.min(...mine.map((p) => timeMs(p, timeSource)))
      const rawSec = (t - group.minTimeMs) / 1000
      if (rawSec <= 1e-9) return LOG_MIN_SEC
      return Math.max(rawSec, LOG_MIN_SEC)
    })

    return {
      label: providerIdChartLabel(provider),
      data,
      borderColor: COLORS[index % COLORS.length]!,
      backgroundColor: COLORS[index % COLORS.length]!,
      borderDash: DASHES[index % DASHES.length],
      pointStyle: POINT_STYLES[index % POINT_STYLES.length] as string,
      spanGaps: true,
    }
  })

  return { labels, datasets, columns }
}

export function formatDelayTick(sec: number): string {
  if (sec <= LOG_MIN_SEC * 1.01) return '0'
  if (sec < 1) return `${Math.round(sec * 1000)}ms`
  if (sec < 60) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`
  return `${(sec / 60).toFixed(1)}min`
}

export { LOG_MIN_SEC }
