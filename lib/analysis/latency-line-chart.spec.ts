import { describe, expect, it } from 'vitest'

import { buildLatencyLineChart, LOG_MIN_SEC } from './latency-line-chart'
import type { ProviderChartPoint } from './provider-chart'

describe('buildLatencyLineChart', () => {
  it('builds labels and per-provider delays vs winner', () => {
    const key = '6:2:YellowCard:0:0'
    const points: ProviderChartPoint[] = [
      {
        provider: '8',
        timeEs: 1000,
        timePayload: 1000,
        incidentKey: key,
        messageProviderSeq: 1,
        name: 'YellowCard',
        kind: 'Statistic',
        scoreLabel: '0:0',
      },
      {
        provider: '253',
        timeEs: 1500,
        timePayload: 1500,
        incidentKey: key,
        messageProviderSeq: 2,
        name: 'YellowCard',
        kind: 'Statistic',
        scoreLabel: '0:0',
      },
    ]

    const model = buildLatencyLineChart(points, 'es_timestamp', null)
    expect(model.labels).toEqual(['YellowCard 0:0'])
    expect(model.columns[0]?.winnerProvider).toBe('8')

    const p8 = model.datasets.find((d) => d.label === 'Bet365 (8)')
    const p253 = model.datasets.find((d) => d.label === 'Statscore (253)')
    expect(p8?.data[0]).toBe(LOG_MIN_SEC)
    expect(p253?.data[0]).toBeCloseTo(0.5, 5)
  })
})
