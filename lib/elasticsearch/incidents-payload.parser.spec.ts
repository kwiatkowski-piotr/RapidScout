import { describe, expect, it } from 'vitest'

import {
  extractIncidentsFromPayload,
  summarizeIncidentTypes,
} from './incidents-payload.parser'

describe('extractIncidentsFromPayload', () => {
  it('extracts incidents from Livescore.Periods', () => {
    const payload = {
      FixtureId: 18664683,
      Livescore: {
        Periods: [
          {
            Type: 1,
            Incidents: [
              {
                Period: 1,
                IncidentType: 27,
                Seconds: 120,
                ParticipantPosition: '1',
              },
            ],
          },
        ],
      },
    }

    const incidents = extractIncidentsFromPayload(payload, 42)
    expect(incidents).toHaveLength(1)
    expect(incidents[0]).toMatchObject({
      messageProviderSeq: 42,
      period: 1,
      incidentType: 27,
      seconds: 120,
      participantPosition: '1',
    })
  })

  it('extracts top-level Incidents when Periods are empty', () => {
    const payload = {
      Incidents: [{ Period: 2, IncidentType: 5, Seconds: 10 }],
    }

    const incidents = extractIncidentsFromPayload(payload, 7)
    expect(incidents).toHaveLength(1)
    expect(incidents[0].incidentType).toBe(5)
  })

  it('returns empty array for invalid payload', () => {
    expect(extractIncidentsFromPayload(null, 1)).toEqual([])
    expect(extractIncidentsFromPayload('x', 1)).toEqual([])
  })
})

describe('summarizeIncidentTypes', () => {
  it('counts incident types', () => {
    const summary = summarizeIncidentTypes([
      { messageProviderSeq: 1, incidentType: 27 },
      { messageProviderSeq: 2, incidentType: 27 },
      { messageProviderSeq: 3 },
    ])
    expect(summary).toEqual({ '27': 2, unknown: 1 })
  })
})
