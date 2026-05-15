import { describe, expect, it } from 'vitest'

import { extractIncidentsWithContext } from '../elasticsearch/incidents-payload.parser'
import {
  buildProviderChart,
  summarizeProviderChart,
  topProviderByWins,
} from './provider-chart'
import fixture from './fixtures/event-18664683-sample.json'

describe('provider-chart', () => {
  it('builds points and summaries from fixture (2 providers, 3 incidents)', () => {
    const incidents = fixture.flatMap((row) =>
      extractIncidentsWithContext(row.payload, {
        messageProviderSeq: row.providerSeq,
        reportedAtEs: row.reportedAtEs,
        messageProvider: row.messageProvider,
      }),
    )

    expect(incidents).toHaveLength(3)

    const chart = buildProviderChart(incidents)
    expect(chart.points).toHaveLength(3)
    expect(chart.points.map((p) => p.provider)).toEqual(
      expect.arrayContaining(['10030', '75']),
    )

    const esSummary = chart.summaryEs
    expect(esSummary.providers).toEqual(expect.arrayContaining(['10030', '75']))
    expect(esSummary.winsByProvider['75']).toBe(1)
    expect(esSummary.winsByProvider['10030']).toBe(1)
    expect(topProviderByWins(esSummary)?.wins).toBe(1)
  })

  it('ranks by payload timestamps for shared incident key', () => {
    const incidents = fixture.flatMap((row) =>
      extractIncidentsWithContext(row.payload, {
        messageProviderSeq: row.providerSeq,
        reportedAtEs: row.reportedAtEs,
        messageProvider: row.messageProvider,
      }),
    )

    const chart = buildProviderChart(incidents)
    const shared = chart.points.filter((p) => p.incidentKey === '27:1:1')
    expect(shared.map((p) => p.provider).sort()).toEqual(['10030', '75'])
    expect(
      Math.min(...shared.map((p) => p.timePayload)),
    ).toBe(1747172399000)
  })
})
