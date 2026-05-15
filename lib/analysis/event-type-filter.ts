import type { ProviderChartPoint } from './provider-chart'

export type ChartEventPoint = Pick<
  ProviderChartPoint,
  'incidentType' | 'name' | 'kind'
>

export type EventTypeOption = {
  key: string
  label: string
  kind?: string
  name?: string
  incidentType?: number
}

/** LSI: Kind + Name. Trade/Livescore: numeric IncidentType. */
export function eventTypeKey(point: ChartEventPoint): string {
  if (point.kind && point.name) return `${point.kind}:${point.name}`
  if (point.incidentType !== undefined) return `id:${point.incidentType}`
  return 'unknown'
}

export function eventTypeLabel(key: string): string {
  if (key === 'unknown') return 'Nieznany'
  if (key.startsWith('id:')) return `IncidentType ${key.slice(3)}`
  const colon = key.indexOf(':')
  if (colon === -1) return key
  const kind = key.slice(0, colon)
  const name = key.slice(colon + 1)
  return `${name} (${kind})`
}

/**
 * Najważniejsze zdarzenia piłkarskie (LSI Incidents.Extracted).
 * @see https://docs.lsports.eu/u/trade/enumerations/statistics-and-incidents
 */
export const FOOTBALL_DEFAULT_LSI_EVENTS: ReadonlyArray<{
  kind: string
  name: string
}> = [
  { kind: 'Score', name: 'Score' },
  { kind: 'Statistic', name: 'YellowCard' },
  { kind: 'Statistic', name: 'RedCard' },
  { kind: 'Statistic', name: 'Penalties' },
  { kind: 'Statistic', name: 'MissedPenalty' },
  { kind: 'Statistic', name: 'Substitutions' },
  { kind: 'Statistic', name: 'Player Goals' },
  { kind: 'Statistic', name: 'Right Foot Goals' },
  { kind: 'Statistic', name: 'Left foot Goals' },
  { kind: 'Statistic', name: 'Header Goals (Raw)' },
  { kind: 'Statistic', name: 'Free Kick Goals (Raw)' },
  { kind: 'Statistic', name: 'Goals From Outside the Penalty Area' },
  { kind: 'Statistic', name: 'Player Yellow Card' },
  { kind: 'Statistic', name: 'Player Red Card' },
  { kind: 'Period', name: 'Period' },
  { kind: 'FixtureStatus', name: 'FixtureStatus' },
]

/** Trade Livescore IncidentType — m.in. kartki i gole. */
export const FOOTBALL_DEFAULT_TRADE_INCIDENT_TYPE_IDS = new Set([
  6, // YellowCard
  7, // RedCard
  9, // Goal
  10, // OwnGoal
  11, // Penalty
  12, // MissedPenalty
  27, // często używany w payloadach testowych
])

const DEFAULT_LSI_KEYS = new Set(
  FOOTBALL_DEFAULT_LSI_EVENTS.map((e) => `${e.kind}:${e.name}`),
)

export function isFootballDefaultEventKey(key: string): boolean {
  if (DEFAULT_LSI_KEYS.has(key)) return true
  if (key.startsWith('id:')) {
    const id = Number.parseInt(key.slice(3), 10)
    return FOOTBALL_DEFAULT_TRADE_INCIDENT_TYPE_IDS.has(id)
  }
  return false
}

const KIND_DISPLAY_ORDER = [
  'Score',
  'Period',
  'FixtureStatus',
  'Possession',
  'Timer',
  'Statistic',
  'PlayerStatistic',
  'Inne',
] as const

export function optionDisplayName(option: EventTypeOption): string {
  if (option.name) return option.name
  if (option.incidentType !== undefined) return `Typ ${option.incidentType}`
  return option.label
}

export function groupEventTypeOptions(
  options: EventTypeOption[],
): Array<{ kind: string; items: EventTypeOption[] }> {
  const map = new Map<string, EventTypeOption[]>()

  for (const option of options) {
    const kind =
      option.kind ??
      (option.key.startsWith('id:') ? 'Inne' : 'Nieznane')
    const bucket = map.get(kind) ?? []
    bucket.push(option)
    map.set(kind, bucket)
  }

  for (const items of map.values()) {
    items.sort((a, b) =>
      optionDisplayName(a).localeCompare(optionDisplayName(b), 'pl'),
    )
  }

  const orderIndex = new Map(
    KIND_DISPLAY_ORDER.map((kind, index) => [kind, index]),
  )

  return [...map.entries()]
    .sort(([a], [b]) => {
      const ai = orderIndex.get(a as (typeof KIND_DISPLAY_ORDER)[number]) ?? 99
      const bi = orderIndex.get(b as (typeof KIND_DISPLAY_ORDER)[number]) ?? 99
      if (ai !== bi) return ai - bi
      return a.localeCompare(b, 'pl')
    })
    .map(([kind, items]) => ({ kind, items }))
}

export function buildEventTypeOptions(
  points: ChartEventPoint[],
): EventTypeOption[] {
  const map = new Map<string, EventTypeOption>()

  for (const point of points) {
    const key = eventTypeKey(point)
    if (map.has(key)) continue
    map.set(key, {
      key,
      label: eventTypeLabel(key),
      kind: point.kind,
      name: point.name,
      incidentType: point.incidentType,
    })
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pl'))
}

export function defaultSelectedEventKeys(availableKeys: string[]): string[] {
  const defaults = availableKeys.filter(isFootballDefaultEventKey)
  if (defaults.length > 0) return defaults
  return availableKeys
}

export function filterPointsByEventKeys<T extends ChartEventPoint>(
  points: T[],
  selectedKeys: string[],
): T[] {
  if (selectedKeys.length === 0) return []
  const allowed = new Set(selectedKeys)
  return points.filter((point) => allowed.has(eventTypeKey(point)))
}
