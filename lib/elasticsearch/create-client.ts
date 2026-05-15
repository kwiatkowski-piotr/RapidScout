import { Client } from '@elastic/elasticsearch'

import { config } from '../config/env'
import { tshSetup } from '../teleport/tsh'

let clientPromise: Promise<Client> | undefined

export async function createElasticClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connectElasticClient().catch((error) => {
      clientPromise = undefined
      throw error
    })
  }
  return clientPromise
}

async function connectElasticClient(): Promise<Client> {
  let node: string

  if (config.TSH) {
    const tshProxyResult = await tshSetup(config.TELEPORT_APP, {
      proxy: config.TELEPORT_PROXY,
    })
    node = `http://127.0.0.1:${tshProxyResult.port}`
    console.info(
      `[rapidscout] Elasticsearch via ${config.TELEPORT_APP} at ${node}`,
    )
  } else {
    node = config.ELASTIC_URL
    console.info(`[rapidscout] Elasticsearch at ${node}`)
  }

  const es = new Client({ node, requestTimeout: 30_000 })

  try {
    const info = await es.info()
    console.info('[rapidscout] Elasticsearch connected:', info.version?.number)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Nie można połączyć z Elasticsearch (${node}): ${detail}`,
    )
  }

  return es
}
