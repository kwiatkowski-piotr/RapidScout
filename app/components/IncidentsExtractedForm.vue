<script setup lang="ts">
import { z } from 'zod'

const emit = defineEmits<{
  submit: [query: AnalyzeQuery]
}>()

export type AnalyzeQuery = {
  eventId: string
  timestampFrom: string
  timestampTo: string
  environment: 'beta' | 'production'
}

const schema = z
  .object({
    eventId: z.string().min(1, 'Event ID is required'),
    timestampFrom: z.string().min(1, 'Start time is required'),
    timestampTo: z.string().min(1, 'End time is required'),
    environment: z.enum(['beta', 'production']),
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
