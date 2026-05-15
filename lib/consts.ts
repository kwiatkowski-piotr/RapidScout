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
