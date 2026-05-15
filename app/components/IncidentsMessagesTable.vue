<script setup lang="ts">
import type { MessageRow } from './JsonModal.vue'

defineProps<{
  messages: MessageRow[]
  loading?: boolean
}>()

const emit = defineEmits<{
  inspect: [message: MessageRow]
}>()
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">Wiadomości</h2>
    </template>

    <div v-if="loading" class="py-8 text-center text-muted">Ładowanie…</div>
    <div
      v-else-if="messages.length === 0"
      class="py-8 text-center text-muted"
    >
      Brak wiadomości w podanym zakresie.
    </div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left">
            <th class="py-2 pr-4">#</th>
            <th class="py-2 pr-4">Seq</th>
            <th class="py-2 pr-4">Timestamp</th>
            <th class="py-2 pr-4">Topic</th>
            <th class="py-2">Akcje</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(msg, index) in messages"
            :key="msg.providerSeq"
            class="border-b border-default/50"
          >
            <td class="py-2 pr-4">{{ index + 1 }}</td>
            <td class="py-2 pr-4 font-mono">{{ msg.providerSeq }}</td>
            <td class="py-2 pr-4">{{ msg.timestamp }}</td>
            <td class="py-2 pr-4 truncate max-w-xs">{{ msg.topic }}</td>
            <td class="py-2">
              <UButton size="xs" variant="soft" @click.stop="emit('inspect', msg)">
                Inspect
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
