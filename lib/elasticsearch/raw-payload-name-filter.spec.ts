import { describe, expect, it } from 'vitest'

import { buildRawPayloadNameFilter } from './raw-payload-name-filter'

describe('buildRawPayloadNameFilter', () => {
  it('builds bool should for compact and spaced JSON', () => {
    const q = buildRawPayloadNameFilter(['Score']) as {
      bool: { should: { match_phrase: { rawPayload: string } }[] }
    }
    expect(q.bool.should.some((c) => c.match_phrase.rawPayload === '"Name":"Score"')).toBe(
      true,
    )
    expect(q.bool.should.some((c) => c.match_phrase.rawPayload === '"Name": "Score"')).toBe(
      true,
    )
  })

  it('rejects dangerous characters in names', () => {
    const q = buildRawPayloadNameFilter(['Score";{']) as { match_all?: object }
    expect('match_all' in q).toBe(true)
  })
})
