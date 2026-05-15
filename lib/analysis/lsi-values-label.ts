function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** E.g. Values [{Position:"1",Value:"0"},{Position:"2",Value:"1"}] → "0:1" */
export function formatValuesAsScoreLabel(payload: Record<string, unknown>): string | undefined {
  const values = payload.Values
  if (!Array.isArray(values)) return undefined

  const rows = values
    .filter(isRecord)
    .map((v) => ({
      position:
        typeof v.Position === 'string' || typeof v.Position === 'number'
          ? String(v.Position)
          : '',
      value:
        typeof v.Value === 'string' || typeof v.Value === 'number'
          ? String(v.Value)
          : '',
    }))
    .filter((r) => r.position)
    .sort((a, b) => a.position.localeCompare(b.position, undefined, { numeric: true }))

  if (rows.length === 0) return undefined
  return rows.map((r) => r.value).join(':')
}

export function lsiOccurrenceTieBreak(
  payload: Record<string, unknown>,
  reportedAtEs: number,
): string {
  const fromValues = formatValuesAsScoreLabel(payload)
  if (fromValues !== undefined) return fromValues
  if (typeof payload.Timestamp === 'string' && payload.Timestamp.trim()) {
    return payload.Timestamp.trim()
  }
  return String(reportedAtEs)
}
