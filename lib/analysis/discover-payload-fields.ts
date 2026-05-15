function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Recursively collects dot-separated paths for keys in payload JSON.
 * Descends into Livescore.Periods[].Incidents[] and top-level Incidents[].
 */
export function collectPayloadFieldPaths(
  value: unknown,
  prefix = '',
  out = new Set<string>(),
): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPayloadFieldPaths(item, prefix, out)
    }
    return [...out].sort()
  }

  if (!isRecord(value)) return [...out].sort()

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    out.add(path)
    collectPayloadFieldPaths(child, path, out)
  }

  return [...out].sort()
}

export function filterProviderCandidatePaths(paths: string[]): string[] {
  return paths.filter((path) =>
    /provider|source|feed|origin/i.test(path.split('.').pop() ?? path),
  )
}

export function getValueAtPath(
  root: unknown,
  path: string,
): unknown | undefined {
  if (!path) return root

  let current: unknown = root
  for (const segment of path.split('.')) {
    if (Array.isArray(current)) {
      const values = current
        .map((item) => getValueAtPath(item, segment))
        .filter((v) => v !== undefined)
      if (values.length === 0) return undefined
      if (values.length === 1) {
        current = values[0]
        continue
      }
      return values
    }
    if (!isRecord(current)) return undefined
    current = current[segment]
  }
  return current
}

export function pickFirstStringAtPaths(
  root: unknown,
  paths: readonly string[],
): { path: string; value: string } | undefined {
  for (const path of paths) {
    const raw = getValueAtPath(root, path)
    if (raw === undefined || raw === null) continue

    if (typeof raw === 'string' && raw.trim()) {
      return { path, value: raw.trim() }
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return { path, value: String(raw) }
    }
  }
  return undefined
}
