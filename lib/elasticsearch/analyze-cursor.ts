export function encodeAnalyzeCursor(sort: unknown[]): string {
  return Buffer.from(JSON.stringify(sort), 'utf8').toString('base64url')
}

export function decodeAnalyzeCursor(cursor: string): unknown[] {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) throw new Error('invalid')
    return parsed
  } catch {
    throw new Error('Invalid cursor')
  }
}
