export const indexSchemaVersion = 1

export const INCIDENTS_EXTRACTED_TOPIC =
  'lsports-kafka.DI.LSI.Incidents.Extracted' as const

export const LSPORTS_KAFKA_PROVIDER = 'lsports-kafka'

export const DEFAULT_MAX_RESULTS = 10_000
export const HARD_MAX_RESULTS = 50_000
export const ES_PAGE_SIZE = 1000
export const ES_REQUEST_TIMEOUT_MS = 30_000

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
