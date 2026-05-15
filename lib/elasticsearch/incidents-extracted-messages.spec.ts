import type { Client } from '@elastic/elasticsearch'
import { describe, expect, it, vi } from 'vitest'

import { getIncidentsExtractedMessages } from './incidents-extracted-messages'

describe('getIncidentsExtractedMessages', () => {
  it('paginates with search_after until maxResults', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        hits: {
          hits: [
            {
              _source: { providerSeq: 1 },
              sort: [1],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        hits: { hits: [] },
      })

    const es = { search } as unknown as Client

    const hits = await getIncidentsExtractedMessages(es, {
      index: 'epg-v1-production-lsports-kafka',
      eventId: '18664683',
      timestampFrom: '2026-05-13T21:00:00',
      timestampTo: '2026-05-13T22:46:00',
      maxResults: 5000,
    })

    expect(hits).toHaveLength(1)
    expect(search).toHaveBeenCalledTimes(2)

    const firstCall = search.mock.calls[0][0]
    expect(firstCall.query.bool.must).toEqual(
      expect.arrayContaining([
        { term: { eventId: { value: '18664683' } } },
        {
          term: {
            topic: { value: 'lsports-kafka.DI.LSI.Incidents.Extracted' },
          },
        },
        {
          range: {
            '@timestamp': {
              gte: expect.any(Number),
              lt: expect.any(Number),
            },
          },
        },
      ]),
    )
    expect(firstCall.sort).toEqual([{ providerSeq: 'asc' }])
    expect(firstCall.timeout).toBe('30s')
    expect(firstCall.search_after).toBeUndefined()

    const secondCall = search.mock.calls[1][0]
    expect(secondCall.search_after).toEqual([1])
  })
})
