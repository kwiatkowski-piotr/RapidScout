import { describe, expect, it } from 'vitest'

import { applyIncidentTimeClustering } from './incident-time-cluster'
import type { ExtractedIncident } from '../elasticsearch/incidents-payload.parser'

function lsi(
  seq: number,
  t: number,
  name: string,
  period = 2,
  id = 6,
): ExtractedIncident {
  return {
    messageProviderSeq: seq,
    reportedAtEs: t,
    kind: 'Statistic',
    name,
    period,
    incidentType: id,
    provider: '8',
    incidentKey: 'tmp',
  }
}

describe('applyIncidentTimeClustering', () => {
  it('merges same-name events within gap across providers', () => {
    const incidents: ExtractedIncident[] = [
      lsi(1, 1000, 'YellowCard'),
      lsi(2, 1500, 'YellowCard'),
      lsi(3, 20_000, 'YellowCard'),
    ]
    applyIncidentTimeClustering(incidents, 12_000)
    expect(incidents[0]?.incidentKey).toBe(incidents[1]?.incidentKey)
    expect(incidents[2]?.incidentKey).not.toBe(incidents[0]?.incidentKey)
  })

  it('does not merge different statistic names', () => {
    const incidents: ExtractedIncident[] = [
      lsi(1, 1000, 'YellowCard'),
      lsi(2, 1100, 'RedCard'),
    ]
    applyIncidentTimeClustering(incidents, 12_000)
    expect(incidents[0]?.incidentKey).not.toBe(incidents[1]?.incidentKey)
  })
})
