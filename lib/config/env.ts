import { z } from 'zod'

function zCoercedBoolean(defaultValue: boolean) {
  return z
    .union([z.boolean(), z.string()])
    .transform((value) => {
      if (typeof value === 'boolean') return value
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes'].includes(normalized)) return true
      if (['false', '0', 'no'].includes(normalized)) return false
      return defaultValue
    })
    .default(defaultValue)
}

const EnvSchema = z.object({
  TSH: zCoercedBoolean(true),
  ELASTIC_URL: z.string().default('http://127.0.0.1:9200'),
  TELEPORT_PROXY: z.string().default('teleport.statscore.com'),
  TELEPORT_APP: z.string().default('es-feed-saver'),
})

export const config = EnvSchema.parse(process.env)
