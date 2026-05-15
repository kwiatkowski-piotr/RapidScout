export interface MessageDocument {
  '@timestamp': number
  appMode: string
  eventId: string
  topic: string
  provider: string
  providerSeq: number
  headers: Record<string, unknown>
  rawPayload: string
  rawPayloadLength: number
}
