<script setup lang="ts">
import type { AnalyzeQuery } from '~/components/IncidentsExtractedForm.vue'
import type { MessageRow, PayloadQuery } from '~/components/JsonModal.vue'
import type {
  AnalysisSummary,
  IncidentRow,
} from '~/components/IncidentsTimelineTable.vue'
import type { ProviderChartData } from '~/components/IncidentsProviderChart.vue'
import type { ProviderTimeSource } from '~/components/ProviderTimeSourceToggle.vue'

const MAX_ANALYZE_PAGES = 500

type AnalyzeResponse = {
  meta: {
    eventId: string
    topic: string
    index: string
    timestampFrom: string
    timestampTo: string
    messageCount: number
    truncated?: boolean
    pageMode?: boolean
    nextCursor?: string | null
    pageSize?: number
    payloadNamesFilter?: string[]
  }
  messages: MessageRow[]
  analysis: {
    incidents: IncidentRow[]
    summary: AnalysisSummary
    providerChart?: ProviderChartData
  }
}

const providerTimeSource = ref<ProviderTimeSource>('es_timestamp')

const toast = useToast()
const analyzeQuery = ref<AnalyzeQuery | null>(null)

const data = ref<AnalyzeResponse | null>(null)
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const pagedTruncated = ref(false)

function normalizeDatetime(value: string): string {
  if (value.length === 16) return `${value}:00`
  return value
}

function buildAnalyzeQuery(
  query: AnalyzeQuery,
): Record<string, string | number> {
  const q: Record<string, string | number> = {
    eventId: query.eventId,
    timestampFrom: normalizeDatetime(query.timestampFrom),
    timestampTo: normalizeDatetime(query.timestampTo),
    environment: query.environment,
  }
  const names = query.payloadNames.trim()
  if (names) q.payloadNames = names
  return q
}

async function onAnalyze(query: AnalyzeQuery) {
  analyzeQuery.value = query
  status.value = 'pending'
  pagedTruncated.value = false
  data.value = null

  try {
    const base = buildAnalyzeQuery(query)

    if (query.usePagedFetch) {
      const allMessages: MessageRow[] = []
      const allIncidents: IncidentRow[] = []
      let cursor: string | undefined
      let firstMeta: AnalyzeResponse['meta'] | null = null

      for (let page = 0; page < MAX_ANALYZE_PAGES; page++) {
        const pageQuery: Record<string, string | number> = {
          ...base,
          pageSize: query.pageSize,
        }
        if (cursor) pageQuery.cursor = cursor

        const res = await $fetch<AnalyzeResponse>(
          '/api/incidents-extracted/analyze',
          { query: pageQuery },
        )
        if (!firstMeta) firstMeta = res.meta
        allMessages.push(...res.messages)
        allIncidents.push(...res.analysis.incidents)
        cursor = res.meta.nextCursor ?? undefined
        if (!cursor) break
      }

      pagedTruncated.value = Boolean(cursor)

      const processed = await $fetch<{ analysis: AnalyzeResponse['analysis'] }>(
        '/api/incidents-extracted/analyze-process',
        {
          method: 'POST',
          body: {
            incidents: allIncidents,
            messagesCount: allMessages.length,
          },
        },
      )

      data.value = {
        meta: {
          ...firstMeta!,
          messageCount: allMessages.length,
          truncated: pagedTruncated.value,
          pageMode: false,
          nextCursor: null,
        },
        messages: allMessages,
        analysis: processed.analysis,
      }
    } else {
      const res = await $fetch<AnalyzeResponse>(
        '/api/incidents-extracted/analyze',
        {
          query: {
            ...base,
            maxResults: query.maxResults,
          },
        },
      )
      data.value = res
    }

    status.value = 'success'
  } catch (error) {
    status.value = 'error'
    toast.add({
      title: 'Błąd analizy',
      description:
        error instanceof Error
          ? error.message
          : 'Nie udało się pobrać danych z Elasticsearch.',
      color: 'error',
    })
  }
}

function openJsonModal(message: MessageRow) {
  if (!analyzeQuery.value) return
  modalMessage.value = message
  modalQuery.value = {
    eventId: analyzeQuery.value.eventId,
    timestampFrom: normalizeDatetime(analyzeQuery.value.timestampFrom),
    timestampTo: normalizeDatetime(analyzeQuery.value.timestampTo),
    environment: analyzeQuery.value.environment,
  }
  isModalOpen.value = true
}

const showLargeWarning = computed(
  () => (data.value?.meta.messageCount ?? 0) > 25_000,
)

const isModalOpen = ref(false)
const modalMessage = ref<MessageRow>()
const modalQuery = ref<PayloadQuery>()
</script>

<template>
  <div class="space-y-6">
    <IncidentsExtractedForm @submit="onAnalyze" />

    <UAlert
      v-if="pagedTruncated"
      color="error"
      title="Przerwano stronicowanie"
      :description="`Osiągnięto limit ${MAX_ANALYZE_PAGES} stron — dane mogą być niekompletne. Zawęź czas lub zwiększ rozmiar strony.`"
    />

    <UAlert
      v-if="showLargeWarning"
      color="warning"
      title="Duży wynik"
      description="Pobrano ponad 25 000 wiadomości. Zapytanie może być wolne — rozważ zwężenie przedziału czasu lub mniejszy limit."
    />

    <UAlert
      v-if="data?.meta?.truncated && !pagedTruncated"
      color="error"
      title="Wynik obcięty przez limit wiadomości"
      description="Pobrano tylko pierwsze wiadomości (sortowanie: providerSeq rosnąco). Późniejsze zdarzenia — w tym zmiany wyniku w komunikatach Score (Values) — mogą nie trafić na wykres. Zwiększ „Limit wiadomości z ES” (np. 50 000) i ponów analizę."
    />

    <UCard v-if="data?.meta">
      <p class="text-sm text-muted">
        Indeks: <code>{{ data.meta.index }}</code> ·
        {{ data.meta.messageCount }} wiadomości
        <span v-if="data.meta.truncated"> (limit osiągnięty)</span>
        <span
          v-if="(data.meta.payloadNamesFilter?.length ?? 0) > 0"
          class="ml-1"
        >
          · filtr:
          <code>{{ data.meta.payloadNamesFilter?.join(', ') }}</code>
        </span>
      </p>
    </UCard>

    <ClientOnly>
      <IncidentsProviderChart
        :chart="data?.analysis.providerChart"
        :time-source="providerTimeSource"
        :loading="status === 'pending'"
      >
        <template #toggle>
          <ProviderTimeSourceToggle v-model="providerTimeSource" />
        </template>
      </IncidentsProviderChart>
    </ClientOnly>

    <IncidentsMessagesTable
      :messages="data?.messages ?? []"
      :loading="status === 'pending'"
      @inspect="openJsonModal"
    />

    <IncidentsTimelineTable
      :incidents="data?.analysis.incidents ?? []"
      :summary="data?.analysis.summary"
      :loading="status === 'pending'"
    />

    <JsonModal
      v-model="isModalOpen"
      :message="modalMessage"
      :query="modalQuery"
    />
  </div>
</template>
