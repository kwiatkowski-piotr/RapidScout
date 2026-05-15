import { createElasticClient } from '../lib/elasticsearch/create-client.ts'
import { buildLsportsKafkaIndex } from '../lib/consts.ts'
import { getIncidentsExtractedMessages } from '../lib/elasticsearch/incidents-extracted-messages.ts'
import {
  collectPayloadFieldPaths,
  filterProviderCandidatePaths,
} from '../lib/analysis/discover-payload-fields.ts'
import { pickFirstStringAtPaths } from '../lib/analysis/discover-payload-fields.ts'
import { PROVIDER_FIELD_PATHS, PRIMARY_PROVIDER_FIELD } from '../lib/consts.ts'

async function main() {
  const es = await createElasticClient()
  const index = buildLsportsKafkaIndex('production')
  const hits = await getIncidentsExtractedMessages(es, {
    index,
    eventId: '18664683',
    timestampFrom: '2026-05-13T21:00:00',
    timestampTo: '2026-05-13T22:46:00',
    maxResults: 3,
  })

  console.log(`Fetched ${hits.length} hits from ${index}`)

  for (const hit of hits) {
    const source = hit._source
    const payload = JSON.parse(source.rawPayload)
    const paths = collectPayloadFieldPaths(payload)
    const candidates = filterProviderCandidatePaths(paths)
    const picked = pickFirstStringAtPaths(payload, PROVIDER_FIELD_PATHS)

    console.log('---')
    console.log('seq', source.providerSeq, 'doc.provider', source.provider)
    console.log('top keys', Object.keys(payload).slice(0, 12).join(', '))
    console.log('PRIMARY', PRIMARY_PROVIDER_FIELD, '=', payload[PRIMARY_PROVIDER_FIELD])
    console.log('picked', picked)
    console.log('provider candidates', candidates.slice(0, 15).join(', '))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
