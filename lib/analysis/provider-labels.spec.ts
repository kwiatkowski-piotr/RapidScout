import { describe, expect, it } from 'vitest'

import { providerIdChartLabel } from './provider-labels'

describe('providerIdChartLabel', () => {
  it('maps known provider ids to Name (id)', () => {
    expect(providerIdChartLabel('8')).toBe('Bet365 (8)')
    expect(providerIdChartLabel('253')).toBe('Statscore (253)')
  })

  it('falls back to P{id} for unknown ids', () => {
    expect(providerIdChartLabel('75')).toBe('P75')
    expect(providerIdChartLabel('10030')).toBe('P10030')
  })
})
