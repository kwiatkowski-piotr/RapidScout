import { describe, expect, it } from 'vitest'

import { formatValuesAsScoreLabel } from './lsi-values-label'

describe('formatValuesAsScoreLabel', () => {
  it('joins Values by position order', () => {
    const payload = {
      Values: [
        { Position: '2', Value: '1' },
        { Position: '1', Value: '0' },
      ],
    }
    expect(formatValuesAsScoreLabel(payload)).toBe('0:1')
  })

  it('returns undefined when no Values', () => {
    expect(formatValuesAsScoreLabel({})).toBeUndefined()
  })
})
