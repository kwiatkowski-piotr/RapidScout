export function isoToEpochMs(iso: string): number {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid ISO datetime: ${iso}`)
  }
  return ms
}
