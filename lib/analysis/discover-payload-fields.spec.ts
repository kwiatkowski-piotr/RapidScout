import { describe, expect, it } from 'vitest'

import {
  collectPayloadFieldPaths,
  filterProviderCandidatePaths,
  getValueAtPath,
  pickFirstStringAtPaths,
} from './discover-payload-fields'
import fixture from './fixtures/event-18664683-sample.json'

describe('discover-payload-fields', () => {
  it('collects nested paths from fixture payloads', () => {
    const paths = collectPayloadFieldPaths(fixture[0]!.payload)
    expect(paths).toContain('ProviderId')
    expect(paths).toContain('Livescore.Periods')
    expect(paths).toContain('Livescore.Periods.Incidents')
  })

  it('finds provider candidates', () => {
    const paths = collectPayloadFieldPaths(fixture[0]!.payload)
    const candidates = filterProviderCandidatePaths(paths)
    expect(candidates).toContain('ProviderId')
  })

  it('reads values at dot paths', () => {
    expect(getValueAtPath(fixture[0]!.payload, 'ProviderId')).toBe(10030)
  })

  it('picks first provider path', () => {
    const picked = pickFirstStringAtPaths(fixture[0]!.payload, [
      'ProviderId',
      'Provider',
    ])
    expect(picked).toEqual({ path: 'ProviderId', value: '10030' })
  })
})
