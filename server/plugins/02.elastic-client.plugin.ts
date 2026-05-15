import type { Client } from '@elastic/elasticsearch'

import { createElasticClient } from '@lib/elasticsearch/create-client'

let cachedClient: Client | undefined

export async function getElasticClient(): Promise<Client> {
  if (!cachedClient) {
    cachedClient = await createElasticClient()
  }
  return cachedClient
}

/** Nitro plugin intentionally empty — ES connects lazily on first API request. */
export default defineNitroPlugin(() => {})
