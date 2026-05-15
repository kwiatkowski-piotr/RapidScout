<script setup lang="ts">
import type { AnalyzeQuery } from '~/components/IncidentsExtractedForm.vue'
import type { MessageRow, PayloadQuery } from '~/components/JsonModal.vue'
import type {
  AnalysisSummary,
  IncidentRow,
} from '~/components/IncidentsTimelineTable.vue'
import type { ProviderChartData } from '~/components/IncidentsProviderChart.vue'
import type { ProviderTimeSource } from '~/components/ProviderTimeSourceToggle.vue'

type AnalyzeResponse = {
  meta: {
    eventId: string
    topic: string
    index: string
    timestampFrom: string
    timestampTo: string
    messageCount: number
    truncated?: boolean
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

const { data, status, error, execute } = useFetch<AnalyzeResponse>(
  '/api/incidents-extracted/analyze',
  {
    query: computed(() =>
      analyzeQuery.value
        ? {
            eventId: analyzeQuery.value.eventId,
            timestampFrom: normalizeDatetime(analyzeQuery.value.timestampFrom),
            timestampTo: normalizeDatetime(analyzeQuery.value.timestampTo),
            environment: analyzeQuery.value.environment,
            maxResults: analyzeQuery.value.maxResults,
          }
        : {},
    ),
    immediate: false,
    watch: false,
  },
)

const isModalOpen = ref(false)
const modalMessage = ref<MessageRow>()
const modalQuery = ref<PayloadQuery>()

function normalizeDatetime(value: string): string {
  if (value.length === 16) return `${value}:00`
  return value
}

function onAnalyze(query: AnalyzeQuery) {
  analyzeQuery.value = query
  execute()
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

watch(error, (err) => {
  if (!err) return
  toast.add({
    title: 'Błąd analizy',
    description: err.message || 'Nie udało się pobrać danych z Elasticsearch.',
    color: 'error',
  })
})

const showLargeWarning = computed(
  () => (data.value?.meta.messageCount ?? 0) > 25_000,
)
</script>

<template>
  <div class="space-y-6">
    <IncidentsExtractedForm @submit="onAnalyze" />

    <UAlert
      v-if="showLargeWarning"
      color="warning"
      title="Duży wynik"
      description="Pobrano ponad 25 000 wiadomości. Zapytanie może być wolne — rozważ zwężenie przedziału czasu lub mniejszy limit."
    />

    <UAlert
      v-if="data?.meta?.truncated"
      color="error"
      title="Wynik obcięty przez limit wiadomości"
      description="Pobrano tylko pierwsze wiadomości (sortowanie: providerSeq rosnąco). Późniejsze zdarzenia — w tym zmiany wyniku w komunikatach Score (Values) — mogą nie trafić na wykres. Zwiększ „Limit wiadomości z ES” (np. 50 000) i ponów analizę."
    />

    <UCard v-if="data?.meta">
      <p class="text-sm text-muted">
        Indeks: <code>{{ data.meta.index }}</code> ·
        {{ data.meta.messageCount }} wiadomości
        <span v-if="data.meta.truncated"> (limit osiągnięty)</span>
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
