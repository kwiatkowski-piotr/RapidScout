import {
  PRIMARY_PROVIDER_FIELD,
  PROVIDER_FIELD_PATHS,
  PAYLOAD_TIME_FIELD_PATHS,
} from '../consts'
import { pickFirstStringAtPaths, getValueAtPath } from './discover-payload-fields'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function formatProviderValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

export function extractProviderFromPayload(
  payload: unknown,
  incident?: Record<string, unknown>,
): string | undefined {
  if (incident) {
    const fromIncident = pickFirstStringAtPaths(incident, PROVIDER_FIELD_PATHS)
    if (fromIncident) return fromIncident.value
  }

  if (isRecord(payload)) {
    const primary = formatProviderValue(payload[PRIMARY_PROVIDER_FIELD])
    if (primary) return primary

    const fromPayload = pickFirstStringAtPaths(payload, PROVIDER_FIELD_PATHS)
    if (fromPayload) return fromPayload.value
  }

  return undefined
}

function parseTimeValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) {
      return asNumber < 1e12 ? asNumber * 1000 : asNumber
    }
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export function extractPayloadTimeMs(
  payload: unknown,
  incident?: Record<string, unknown>,
): number | undefined {
  if (incident) {
    for (const path of PAYLOAD_TIME_FIELD_PATHS) {
      const segment = path.includes('.') ? path.split('.').pop()! : path
      const raw = incident[segment] ?? getValueAtPath(incident, path)
      const ms = parseTimeValue(raw)
      if (ms !== undefined) return ms
    }
  }

  if (isRecord(payload)) {
    const picked = pickFirstStringAtPaths(payload, PAYLOAD_TIME_FIELD_PATHS)
    if (picked) {
      const raw = getValueAtPath(payload, picked.path)
      return parseTimeValue(raw)
    }
    for (const path of PAYLOAD_TIME_FIELD_PATHS) {
      const ms = parseTimeValue(getValueAtPath(payload, path))
      if (ms !== undefined) return ms
    }
  }

  return undefined
}
