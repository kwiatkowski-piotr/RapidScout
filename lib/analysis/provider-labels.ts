/**
 * Znane ID providerów (LSI / feed) — etykiety na wykresie opóźnień.
 * Nieznane ID: nadal `P{id}`.
 */
const PROVIDER_ID_NAMES: Readonly<Record<string, string>> = {
  '1': 'Unibet',
  '8': 'Bet365',
  '13': 'Bwin',
  '74': 'Marathonbet',
  '108': 'FlashScores',
  '126': 'Sofascore',
  '145': '1XBet',
  '253': 'Statscore',
  '257': 'Betano',
  '300': 'OptaStatsPerform',
  '10020': 'WhoScored',
}

/** Etykieta na wykresie (legenda, tooltip): „Nazwa (id)” lub „P{id}”. */
export function providerIdChartLabel(providerId: string): string {
  const id = providerId.trim()
  if (!id) return '?'
  const name = PROVIDER_ID_NAMES[id]
  if (name) return `${name} (${id})`
  return `P${id}`
}
