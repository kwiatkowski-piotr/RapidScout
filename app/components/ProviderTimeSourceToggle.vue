<script setup lang="ts">
export type ProviderTimeSource = 'es_timestamp' | 'payload_time'

const model = defineModel<ProviderTimeSource>({ default: 'es_timestamp' })

const options = [
  { label: 'Czas ES (Feed Saver)', value: 'es_timestamp' as const },
  { label: 'Czas z payloadu', value: 'payload_time' as const },
]
</script>

<template>
  <UButtonGroup size="sm">
    <UButton
      v-for="option in options"
      :key="option.value"
      :label="option.label"
      :color="model === option.value ? 'primary' : 'neutral'"
      :variant="model === option.value ? 'solid' : 'outline'"
      @click="model = option.value"
    />
  </UButtonGroup>
</template>
