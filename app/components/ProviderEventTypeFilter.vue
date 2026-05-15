<script setup lang="ts">
import {
  buildEventTypeOptions,
  defaultSelectedEventKeys,
  groupEventTypeOptions,
  isFootballDefaultEventKey,
  optionDisplayName,
  type EventTypeOption,
} from '@lib/analysis/event-type-filter'
import type { ProviderChartPoint } from '@lib/analysis/provider-chart'

const props = defineProps<{
  points: ProviderChartPoint[]
}>()

const selectedKeys = defineModel<string[]>({ default: () => [] })

const isGridOpen = ref(true)

const options = computed<EventTypeOption[]>(() =>
  buildEventTypeOptions(props.points),
)

const optionsByKey = computed(
  () => new Map(options.value.map((o) => [o.key, o])),
)

const groupedOptions = computed(() => groupEventTypeOptions(options.value))

const selectedSet = computed(() => new Set(selectedKeys.value))

const selectedOptions = computed(() =>
  selectedKeys.value
    .map((key) => optionsByKey.value.get(key))
    .filter((o): o is EventTypeOption => o !== undefined)
    .sort((a, b) =>
      optionDisplayName(a).localeCompare(optionDisplayName(b), 'pl'),
    ),
)

watch(
  () => props.points,
  (points) => {
    if (points.length === 0) {
      selectedKeys.value = []
      return
    }
    const available = buildEventTypeOptions(points).map((o) => o.key)
    selectedKeys.value = defaultSelectedEventKeys(available)
  },
  { immediate: true },
)

function isSelected(key: string): boolean {
  return selectedSet.value.has(key)
}

function setSelected(key: string, checked: boolean) {
  if (checked) {
    if (!selectedSet.value.has(key)) {
      selectedKeys.value = [...selectedKeys.value, key]
    }
    return
  }
  selectedKeys.value = selectedKeys.value.filter((k) => k !== key)
}

function removeKey(key: string) {
  setSelected(key, false)
}

function selectFootballDefaults() {
  const available = options.value.map((o) => o.key)
  selectedKeys.value = defaultSelectedEventKeys(available)
}

function selectAll() {
  selectedKeys.value = options.value.map((o) => o.key)
}

function clearSelection() {
  selectedKeys.value = []
}

const summaryLabel = computed(() => {
  const total = options.value.length
  const selected = selectedKeys.value.length
  if (total === 0) return 'Brak typów w danych'
  return `${selected} z ${total} typów na wykresie`
})
</script>

<template>
  <div
    v-if="options.length > 0"
    class="space-y-3 rounded-lg border border-default bg-elevated/20 p-3"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <p class="text-sm font-medium">Typy zdarzeń</p>
        <p class="text-xs text-muted">{{ summaryLabel }}</p>
      </div>
      <div class="flex flex-wrap gap-1">
        <UButton
          size="xs"
          color="primary"
          variant="soft"
          label="Kluczowe"
          @click="selectFootballDefaults"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="outline"
          label="Wszystkie"
          @click="selectAll"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          label="Wyczyść"
          @click="clearSelection"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :icon="isGridOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :label="isGridOpen ? 'Zwiń listę' : 'Rozwiń listę'"
          @click="isGridOpen = !isGridOpen"
        />
      </div>
    </div>

    <div>
      <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Aktywne filtry
      </p>
      <div
        v-if="selectedOptions.length > 0"
        class="flex max-h-28 flex-wrap gap-1 overflow-y-auto"
      >
        <UBadge
          v-for="option in selectedOptions"
          :key="option.key"
          color="primary"
          variant="subtle"
          size="sm"
          class="gap-0.5 pr-0.5"
        >
          <span :title="option.label">{{ optionDisplayName(option) }}</span>
          <button
            type="button"
            class="rounded p-0.5 hover:bg-primary/20"
            aria-label="Usuń filtr"
            @click="removeKey(option.key)"
          >
            <UIcon name="i-lucide-x" class="size-3" />
          </button>
        </UBadge>
      </div>
      <p
        v-else
        class="text-xs text-warning"
      >
        Nic nie wybrano — wykres będzie pusty. Użyj „Kluczowe” lub zaznacz typy poniżej.
      </p>
    </div>

    <UCollapsible
      v-model:open="isGridOpen"
      :unmount-on-hide="false"
    >
      <template #content>
        <div class="max-h-[min(50vh,28rem)] space-y-2 overflow-y-auto border-t border-default pt-3">
          <section
            v-for="group in groupedOptions"
            :key="group.kind"
          >
            <h3
              class="sticky top-0 z-10 bg-elevated/95 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted backdrop-blur-sm"
            >
              {{ group.kind }}
              <span class="font-normal">({{ group.items.length }})</span>
            </h3>

            <div
              class="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            >
              <label
                v-for="option in group.items"
                :key="option.key"
                class="flex min-w-0 cursor-pointer items-start gap-1.5 rounded px-0.5 py-0.5 hover:bg-elevated/80"
                :class="{
                  'bg-primary/5 ring-1 ring-primary/20': isSelected(option.key),
                  'font-medium': isFootballDefaultEventKey(option.key),
                }"
                :title="option.label"
              >
                <UCheckbox
                  :model-value="isSelected(option.key)"
                  size="xs"
                  class="mt-0.5 shrink-0"
                  @update:model-value="(v) => setSelected(option.key, Boolean(v))"
                />
                <span class="truncate text-[11px] leading-tight">
                  {{ optionDisplayName(option) }}
                </span>
              </label>
            </div>
          </section>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
