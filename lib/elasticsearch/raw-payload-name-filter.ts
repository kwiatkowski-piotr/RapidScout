/**
 * Filtr na polu `rawPayload` (string JSON) — dopasowanie nazwy zdarzenia LSI (`Name`).
 * Używa dwóch wariantów `match_phrase` (z/bez spacji po dwukropku), bo serializacja JSON bywa różna.
 */
export function buildRawPayloadNameFilter(names: string[]): object {
  const cleaned = names
    .map((n) => n.trim())
    .filter((n) => /^[a-zA-Z0-9 _.'()-]+$/.test(n))
  if (cleaned.length === 0) {
    return { match_all: {} }
  }

  const should: object[] = []
  for (const name of cleaned) {
    should.push({ match_phrase: { rawPayload: `"Name":"${name}"` } })
    should.push({ match_phrase: { rawPayload: `"Name": "${name}"` } })
  }

  return {
    bool: {
      should,
      minimum_should_match: 1,
    },
  }
}
