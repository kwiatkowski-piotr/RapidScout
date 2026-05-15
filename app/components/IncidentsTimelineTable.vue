<script setup lang="ts">
export type IncidentRow = {
  messageProviderSeq: number
  period?: number
  incidentType?: number
  seconds?: number
  participantPosition?: string
  [key: string]: unknown
}

export type AnalysisSummary = {
  messagesCount: number
  incidentsCount: number
  incidentTypes: Record<string, number>
}

defineProps<{
  incidents: IncidentRow[]
  summary?: AnalysisSummary
  loading?: boolean
}>()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap gap-4 justify-between items-center">
        <h2 class="font-semibold">Incidenty</h2>
        <p v-if="summary" class="text-sm text-muted">
          {{ summary.messagesCount }} wiadomości ·
          {{ summary.incidentsCount }} incidentów
        </p>
      </div>
    </template>

    <div
      v-if="summary && Object.keys(summary.incidentTypes).length"
      class="mb-4 flex flex-wrap gap-2"
    >
      <UBadge
        v-for="(count, type) in summary.incidentTypes"
        :key="type"
        variant="subtle"
      >
        Type {{ type }}: {{ count }}
      </UBadge>
    </div>

    <div v-if="loading" class="py-8 text-center text-muted">Ładowanie…</div>
    <div v-else-if="incidents.length === 0" class="py-8 text-center text-muted">
      Brak incidentów w payloadach.
    </div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left">
            <th class="py-2 pr-4">Msg Seq</th>
            <th class="py-2 pr-4">Period</th>
            <th class="py-2 pr-4">Type</th>
            <th class="py-2 pr-4">Seconds</th>
            <th class="py-2">Position</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in incidents"
            :key="`${row.messageProviderSeq}-${i}`"
            class="border-b border-default/50"
          >
            <td class="py-2 pr-4">{{ row.messageProviderSeq }}</td>
            <td class="py-2 pr-4">{{ row.period ?? '—' }}</td>
            <td class="py-2 pr-4">{{ row.incidentType ?? '—' }}</td>
            <td class="py-2 pr-4">{{ row.seconds ?? '—' }}</td>
            <td class="py-2">{{ row.participantPosition ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
