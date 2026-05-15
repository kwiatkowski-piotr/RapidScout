import { describe, expect, it } from 'vitest'

import {
  buildEventTypeOptions,
  defaultSelectedEventKeys,
  eventTypeKey,
  filterPointsByEventKeys,
  groupEventTypeOptions,
  isFootballDefaultEventKey,
} from './event-type-filter'
import type { ProviderChartPoint } from './provider-chart'

describe('event-type-filter', () => {
  it('builds keys from LSI kind+name', () => {
    expect(
      eventTypeKey({ kind: 'Score', name: 'Score', incidentType: 27 }),
    ).toBe('Score:Score')
  })

  it('selects football defaults when present', () => {
    const keys = buildEventTypeOptions([
      { kind: 'Score', name: 'Score' },
      { kind: 'Statistic', name: 'Corners' },
      { kind: 'Statistic', name: 'RedCard' },
    ]).map((o) => o.key)

    const selected = defaultSelectedEventKeys(keys)
    expect(selected).toContain('Score:Score')
    expect(selected).toContain('Statistic:RedCard')
    expect(selected).not.toContain('Statistic:Corners')
  })

  it('filters points by selected keys', () => {
    const points: ProviderChartPoint[] = [
      {
        provider: '8',
        timeEs: 1,
        timePayload: 1,
        incidentKey: 'a',
        messageProviderSeq: 1,
        kind: 'Score',
        name: 'Score',
      },
      {
        provider: '8',
        timeEs: 2,
        timePayload: 2,
        incidentKey: 'b',
        messageProviderSeq: 2,
        kind: 'Statistic',
        name: 'Corners',
      },
    ]

    const filtered = filterPointsByEventKeys(points, ['Score:Score'])
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.name).toBe('Score')
  })

  it('groups options by kind with Score first', () => {
    const groups = groupEventTypeOptions([
      { key: 'Statistic:Corners', label: 'Corners (Statistic)', kind: 'Statistic', name: 'Corners' },
      { key: 'Score:Score', label: 'Score (Score)', kind: 'Score', name: 'Score' },
    ])
    expect(groups[0]?.kind).toBe('Score')
    expect(groups[1]?.kind).toBe('Statistic')
  })

  it('recognizes trade incident type ids as defaults', () => {
    expect(isFootballDefaultEventKey('id:6')).toBe(true)
    expect(isFootballDefaultEventKey('id:999')).toBe(false)
  })
})
