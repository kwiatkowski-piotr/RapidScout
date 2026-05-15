import { describe, expect, it } from 'vitest'

import {
  buildIncidentKey,
  extractIncidentsFromPayload,
  extractIncidentsWithContext,
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

describe('extractIncidentsWithContext', () => {
  it('extracts LSI flat message (Provider.Id, one event per payload)', () => {
    const payload = {
      Timestamp: '2026-05-13T19:00:22.8739578Z',
      Id: 27,
      Name: 'Score',
      Kind: 'Score',
      Provider: { Id: 253 },
      Period: { Id: 2, Name: '1st Half' },
      Fixture: { Id: 18664683 },
    }

    const incidents = extractIncidentsWithContext(payload, {
      messageProviderSeq: 2145929972,
      reportedAtEs: 1747167623000,
      messageProvider: 'lsports-kafka',
    })

    expect(incidents).toHaveLength(1)
    expect(incidents[0]).toMatchObject({
      provider: '253',
      period: 2,
      incidentType: 27,
      incidentKey: '27:2:Score:2026-05-13T19:00:22.8739578Z',
      name: 'Score',
      kind: 'Score',
    })
    expect(incidents[0]?.reportedAtPayload).toBe(Date.parse('2026-05-13T19:00:22.8739578Z'))
  })

  it('attaches provider, times and incidentKey from payload', () => {
    const payload = {
      ProviderId: 10030,
      Timestamp: 1747172400000,
      Livescore: {
        Periods: [
          {
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

    const incidents = extractIncidentsWithContext(payload, {
      messageProviderSeq: 42,
      reportedAtEs: 1747172401000,
      messageProvider: 'lsports-kafka',
    })

    expect(incidents[0]).toMatchObject({
      provider: '10030',
      reportedAtEs: 1747172401000,
      reportedAtPayload: 1747172400000,
      incidentKey: '27:1:1',
    })
  })

  it('falls back to message provider when payload has no ProviderId', () => {
    const payload = {
      Livescore: {
        Periods: [{ Incidents: [{ Period: 1, IncidentType: 5 }] }],
      },
    }

    const incidents = extractIncidentsWithContext(payload, {
      messageProviderSeq: 1,
      reportedAtEs: 1000,
      messageProvider: 'feed-a',
    })

    expect(incidents[0]?.provider).toBe('feed-a')
    expect(incidents[0]?.reportedAtPayload).toBe(1000)
  })
})

describe('buildIncidentKey', () => {
  it('joins type, period and optional position', () => {
    expect(
      buildIncidentKey({
        incidentType: 27,
        period: 1,
        participantPosition: '2',
      }),
    ).toBe('27:1:2')
    expect(buildIncidentKey({ incidentType: 5, period: 2 })).toBe('5:2')
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
