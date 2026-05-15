<script setup lang="ts">
import { z } from 'zod'

import { HARD_MAX_RESULTS } from '@lib/consts'

const emit = defineEmits<{
  submit: [query: AnalyzeQuery]
}>()

export type AnalyzeQuery = {
  eventId: string
  timestampFrom: string
  timestampTo: string
  environment: 'beta' | 'production'
  maxResults: number
  /** Nazwy LSI w rawPayload (np. Score), po przecinku — filtr ES `match_phrase` */
  payloadNames: string
  /** Pełny zakres przez wiele stron + `analyze-process` (mniejsze pojedyncze odpowiedzi JSON) */
  usePagedFetch: boolean
  pageSize: number
}

const schema = z
  .object({
    eventId: z.string().min(1, 'Event ID is required'),
    timestampFrom: z.string().min(1, 'Start time is required'),
    timestampTo: z.string().min(1, 'End time is required'),
    environment: z.enum(['beta', 'production']),
    maxResults: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(HARD_MAX_RESULTS),
    payloadNames: z.string(),
    usePagedFetch: z.boolean(),
    pageSize: z.coerce.number().int().min(500).max(10_000),
  })
  .refine((data) => data.timestampTo > data.timestampFrom, {
    message: 'End must be after start',
    path: ['timestampTo'],
  })

const state = reactive({
  eventId: '18664683',
  timestampFrom: '2026-05-13T21:00',
  timestampTo: '2026-05-13T22:46',
  environment: 'production' as 'beta' | 'production',
  maxResults: 50_000,
  payloadNames: 'Score, Corners, RedCard, YellowCard',
  usePagedFetch: false,
  pageSize: 5000,
})

const errors = ref<string | null>(null)

function onSubmit() {
  const result = schema.safeParse(state)
  if (!result.success) {
    errors.value = result.error.errors.map((e) => e.message).join('; ')
    return
  }
  errors.value = null
  emit('submit', result.data)
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">Analiza meczu</h2>
    </template>

    <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="onSubmit">
      <UFormField label="Event ID" class="sm:col-span-2">
        <UInput v-model="state.eventId" placeholder="18664683" />
      </UFormField>

      <UFormField label="Od">
        <UInput v-model="state.timestampFrom" type="datetime-local" />
      </UFormField>

      <UFormField label="Do">
        <UInput v-model="state.timestampTo" type="datetime-local" />
      </UFormField>

      <UFormField
        v-if="!state.usePagedFetch"
        label="Limit wiadomości z ES"
        description="Rosnąco wg providerSeq. Bramki w polu Score pojawiają się często dopiero po dziesiątkach tysięcy wiadomości — przy obcięciu wykres może pokazywać tylko 0:0."
        class="sm:col-span-2"
      >
        <UInput
          v-model.number="state.maxResults"
          type="number"
          :min="1000"
          :max="HARD_MAX_RESULTS"
          step="1000"
        />
      </UFormField>

      <UFormField
        label="Filtr typów w ES (opcjonalnie)"
        description="Lista nazw LSI po przecinku, np. Score, YellowCard — zapytanie `match_phrase` na polu rawPayload. Puste = wszystkie wiadomości w przedziale czasu."
        class="sm:col-span-2"
      >
        <UTextarea
          v-model="state.payloadNames"
          class="w-full font-mono text-sm"
          :rows="2"
          autoresize
          :maxrows="5"
          placeholder="Score, Corners, RedCard, YellowCard"
        />
      </UFormField>

      <UFormField
        label="Tryb stronicowany"
        description="Wiele żądań GET z cursorem i jedno POST na wykres — mniejsze pojedyncze odpowiedzi JSON."
        class="sm:col-span-2"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <UCheckbox v-model="state.usePagedFetch" label="Pobierz w stronach (cursor)" />
          <UFormField v-if="state.usePagedFetch" label="Rozmiar strony" class="flex-1">
            <UInput
              v-model.number="state.pageSize"
              type="number"
              :min="500"
              :max="10_000"
              step="500"
            />
          </UFormField>
        </div>
      </UFormField>

      <UFormField label="Środowisko" class="sm:col-span-2">
        <URadioGroup
          v-model="state.environment"
          :items="[
            { label: 'production', value: 'production' },
            { label: 'beta', value: 'beta' },
          ]"
        />
      </UFormField>

      <div class="sm:col-span-2 flex items-center gap-4">
        <UButton type="submit" color="primary">Analizuj</UButton>
        <p v-if="errors" class="text-sm text-error">{{ errors }}</p>
      </div>
    </form>
  </UCard>
</template>
