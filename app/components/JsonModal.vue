<script setup lang="ts">
import VueJsonPretty from 'vue-json-pretty'

import 'vue-json-pretty/lib/styles.css'

export type MessageRow = {
  providerSeq: number
  timestamp: string
  topic: string
}

export type PayloadQuery = {
  eventId: string
  timestampFrom: string
  timestampTo: string
  environment: 'beta' | 'production'
}

const props = defineProps<{
  message?: MessageRow
  query?: PayloadQuery
}>()

const isOpen = defineModel<boolean>({ default: false })

const jsonData = ref<unknown>(null)
const loadStatus = ref<'idle' | 'pending' | 'done' | 'error'>('idle')
const loadError = ref<string | null>(null)

async function loadPayload() {
  if (!props.message || !props.query) return

  loadStatus.value = 'pending'
  loadError.value = null
  jsonData.value = null

  try {
    const result = await $fetch<{ rawPayload: unknown }>(
      '/api/incidents-extracted/payload',
      {
        query: {
          eventId: props.query.eventId,
          providerSeq: props.message.providerSeq,
          timestampFrom: props.query.timestampFrom,
          timestampTo: props.query.timestampTo,
          environment: props.query.environment,
        },
      },
    )
    jsonData.value = result.rawPayload
    loadStatus.value = 'done'
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Nie udało się pobrać payloadu'
    loadStatus.value = 'error'
  }
}

watch(isOpen, (open) => {
  if (open) {
    loadPayload()
  } else {
    jsonData.value = null
    loadStatus.value = 'idle'
    loadError.value = null
  }
})

const isLargePayload = computed(() => {
  if (!jsonData.value) return false
  try {
    return JSON.stringify(jsonData.value).length > 200_000
  } catch {
    return true
  }
})
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Payload"
    :description="
      message
        ? `Topic ${message.topic}, seq ${message.providerSeq}, ${message.timestamp}`
        : 'Message payload'
    "
    :ui="{ content: 'w-full sm:max-w-[800px]' }"
  >
    <template #content>
      <UCard
        variant="subtle"
        :ui="{
          root: 'flex flex-col',
          body: 'overflow-y-auto max-h-[70vh] py-4 px-4',
        }"
      >
        <div v-if="loadStatus === 'pending'" class="py-8 text-center text-muted">
          Ładowanie payloadu…
        </div>

        <p v-else-if="loadStatus === 'error'" class="text-error text-sm">
          {{ loadError }}
        </p>

        <template v-else-if="jsonData">
          <UAlert
            v-if="isLargePayload"
            color="warning"
            class="mb-4"
            title="Duży payload"
            description="Podgląd drzewa wyłączony (plik >200 KB). Surowy JSON poniżej."
          />
          <VueJsonPretty
            v-if="!isLargePayload"
            :deep="2"
            :show-icon="false"
            :show-length="false"
            :show-line-number="false"
            :data="jsonData"
          />
          <pre
            v-else
            class="text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap break-all"
          >{{ JSON.stringify(jsonData, null, 2) }}</pre>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
