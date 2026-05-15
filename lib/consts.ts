export const indexSchemaVersion = 1

export const INCIDENTS_EXTRACTED_TOPIC =
  'lsports-kafka.DI.LSI.Incidents.Extracted' as const

export const LSPORTS_KAFKA_PROVIDER = 'lsports-kafka'

export const DEFAULT_MAX_RESULTS = 30_000
export const HARD_MAX_RESULTS = 50_000
export const ES_PAGE_SIZE = 1000
export const ES_REQUEST_TIMEOUT_MS = 30_000

/**
 * Maks. odstęp (ms) między kolejnymi wiadomościami w tym samym kubełku
 * (`Kind` + `Name` + `Period` + `Id`), żeby nadal liczyły się jako **jeden** incydent
 * (np. ten sam żółty kartka u różnych providerów).
 *
 * **Kalibracja (event 18664683, 2026-05-13, próbka ~20k wiadomości):** między
 * kolejnymi komunikatami `YellowCard` w czasie ES pojedynczy odstęp rzędu **~40 s**
 * — interpretujemy to jako **osobne** zdarzenia na boisku. Opóźnienia między
 * providerami dla tej samej aktualizacji bywają rzędu setek ms–kilku sekund;
 * **12 s** daje zapas na wolniejsze feedy i wciąż jest znacznie poniżej typowego
 * odstępu między dwiema kartkami w tym meczu.
 */
export const INCIDENT_TIME_CLUSTER_GAP_MS = 12_000

export type Environment = 'beta' | 'production'

export function buildLsportsKafkaIndex(environment: Environment): string {
  return `epg-v${indexSchemaVersion}-${environment}-${LSPORTS_KAFKA_PROVIDER}`
}

/** Dot paths tried when resolving provider from payload / incident (first match wins). */
export const PROVIDER_FIELD_PATHS = [
  'Provider.Id',
  'ProviderId',
  'Provider',
  'DataProvider',
  'FeedProvider',
  'Source',
  'SourceProvider',
  'Livescore.ProviderId',
] as const

/**
 * Primary provider field on Incidents.Extracted (event 18664683, production).
 * LSI format: nested `Provider.Id`; legacy Trade format may use root `ProviderId`.
 */
export const PRIMARY_PROVIDER_FIELD = 'Provider.Id' as const

/** Dot paths for wall-clock time inside payload (when present). */
export const PAYLOAD_TIME_FIELD_PATHS = [
  'Timestamp',
  'CreationDate',
  'LastUpdate',
  'ServerTimestamp',
  'MessageTimestamp',
  'Date',
] as const
