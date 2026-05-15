<script setup lang="ts">
import {
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  LogarithmicScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Line } from 'vue-chartjs'
import { DateTime } from 'luxon'

import { filterPointsByEventKeys } from '@lib/analysis/event-type-filter'
import {
  buildLatencyLineChart,
  formatDelayTick,
  LOG_MIN_SEC,
} from '@lib/analysis/latency-line-chart'
import {
  summarizeProviderChart,
  type ProviderChartData,
  type ProviderChartPoint,
  type ProviderChartSummary,
} from '@lib/analysis/provider-chart'

import type { ProviderTimeSource } from './ProviderTimeSourceToggle.vue'

export type { ProviderChartData, ProviderChartPoint, ProviderChartSummary }

const props = defineProps<{
  chart?: ProviderChartData | null
  timeSource: ProviderTimeSource
  loading?: boolean
}>()

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  Tooltip,
  Legend,
  zoomPlugin,
)

const selectedEventKeys = ref<string[]>([])
const quickNameFilter = ref<string | null>(null)

const allPoints = computed(() => props.chart?.points ?? [])

const pointsAfterTypeFilter = computed(() =>
  filterPointsByEventKeys(allPoints.value, selectedEventKeys.value),
)

const quickNameOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const p of pointsAfterTypeFilter.value) {
    const n = p.name?.trim()
    if (!n) continue
    counts.set(n, (counts.get(n) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pl'))
    .slice(0, 16)
    .map(([name]) => name)
})

watch(quickNameOptions, (names) => {
  if (
    quickNameFilter.value !== null &&
    !names.some((n) => n === quickNameFilter.value)
  ) {
    quickNameFilter.value = null
  }
})

const chartPoints = computed(() => {
  const base = pointsAfterTypeFilter.value
  const q = quickNameFilter.value
  if (!q) return base
  return base.filter((p) => (p.name ?? '').toLowerCase() === q.toLowerCase())
})

const latencyModel = computed(() =>
  buildLatencyLineChart(chartPoints.value, props.timeSource, null),
)

const typeSummary = computed(() =>
  summarizeProviderChart(pointsAfterTypeFilter.value, props.timeSource),
)

const fastestProvider = computed(() => {
  const summary = typeSummary.value
  let best: { provider: string; wins: number } | undefined
  for (const [provider, wins] of Object.entries(summary.winsByProvider)) {
    if (!best || wins > best.wins) best = { provider, wins }
  }
  return best
})

const hasRawPoints = computed(() => allPoints.value.length > 0)
const hasFilteredPoints = computed(() => chartPoints.value.length > 0)

const lineData = computed(() => ({
  labels: latencyModel.value.labels,
  datasets: latencyModel.value.datasets.map((ds) => ({
    ...ds,
    borderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointHitRadius: 10,
    tension: 0,
    fill: false,
  })),
}))

const chartRef = ref<{ chart?: Chart } | null>(null)

function resetZoom() {
  chartRef.value?.chart?.resetZoom()
}

const chartOptions = computed(() => {
  const columns = latencyModel.value.columns
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      axis: 'x' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 14, usePointStyle: true, padding: 12 },
      },
      tooltip: {
        callbacks: {
          title(items: { dataIndex: number }[]) {
            const idx = items[0]?.dataIndex
            if (idx === undefined) return ''
            return columns[idx]?.xLabel ?? ''
          },
          label(ctx: {
            dataset: { label?: string }
            parsed: { y: number }
            dataIndex: number
          }) {
            const col = columns[ctx.dataIndex]
            const y = ctx.parsed.y
            const delay =
              y <= LOG_MIN_SEC * 1.01
                ? '0 (zwycięzca)'
                : formatDelayTick(y)
            const when = col
              ? DateTime.fromMillis(col.minTimeMs).toFormat(
                  'yyyy-MM-dd HH:mm:ss.SSS',
                )
              : ''
            return [
              `${ctx.dataset.label ?? ''}: opóźnienie ${delay}`,
              col ? `Najszybciej: P${col.winnerProvider}` : '',
              col ? `Czas ref.: ${when}` : '',
            ].filter(Boolean)
          },
        },
      },
      zoom: {
        limits: {
          x: { minRange: 1 },
          y: { minRange: 0.0001 },
        },
        pan: {
          enabled: true,
          mode: 'xy' as const,
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'xy' as const,
        },
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        title: {
          display: true,
          text: 'Zdarzenie (typ + stan z Values, jeśli jest)',
        },
        ticks: {
          maxRotation: 55,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 24,
          font: { size: 10 },
        },
      },
      y: {
        type: 'logarithmic' as const,
        min: LOG_MIN_SEC,
        title: {
          display: true,
          text: 'Opóźnienie (s) — skala log',
        },
        ticks: {
          callback(raw: string | number) {
            const v = Number(raw)
            return formatDelayTick(v)
          },
        },
      },
    },
  }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-semibold">Opóźnienie providerów</h2>
        <slot name="toggle" />
      </div>
    </template>

    <div v-if="loading" class="py-12 text-center text-sm text-muted">
      Ładowanie wykresu…
    </div>

    <UAlert
      v-else-if="!hasRawPoints"
      color="neutral"
      title="Brak danych do wykresu"
      description="Nie znaleziono zdarzeń do wykresu. Sprawdź payload (Provider.Id, Name/Kind) w Inspect lub zwęż zakres czasu."
    />

    <div v-else class="space-y-4">
      <ProviderEventTypeFilter
        v-model="selectedEventKeys"
        :points="allPoints"
      />

      <div
        v-if="quickNameOptions.length > 0"
        class="flex flex-wrap items-center gap-1.5"
      >
        <span class="text-xs text-muted">Szybki filtr:</span>
        <UButton
          size="xs"
          :color="quickNameFilter === null ? 'primary' : 'neutral'"
          :variant="quickNameFilter === null ? 'solid' : 'outline'"
          label="Wszystkie"
          @click="quickNameFilter = null"
        />
        <UButton
          v-for="name in quickNameOptions"
          :key="name"
          size="xs"
          :color="quickNameFilter === name ? 'primary' : 'neutral'"
          :variant="quickNameFilter === name ? 'solid' : 'outline'"
          :label="name"
          @click="quickNameFilter = quickNameFilter === name ? null : name"
        />
      </div>

      <UAlert
        v-if="!hasFilteredPoints"
        color="warning"
        title="Brak punktów dla filtra"
        description="Wybierz inne typy zdarzeń lub szybki filtr albo użyj „Kluczowe”."
      />

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p
            v-if="fastestProvider"
            class="text-sm text-muted"
          >
            Pierwszeństwo (wg grup zdarzeń, wybrane typy):
            <strong>P{{ fastestProvider.provider }}</strong>
            ({{ fastestProvider.wins }})
            <span class="text-muted">
              · {{ chartPoints.length }} punktów ·
              {{ latencyModel.labels.length }} zdarzeń na osi X
            </span>
          </p>
          <p class="text-xs text-muted">
            Zoom: kółko · przesuwanie: przeciągnij ·
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              label="Reset widoku"
              @click="resetZoom"
            />
          </p>
        </div>

        <div class="h-112">
          <Line
            ref="chartRef"
            :data="lineData"
            :options="chartOptions"
          />
        </div>

        <p class="text-xs text-muted leading-relaxed">
          Oś Y w skali logarytmicznej. Wartość przy 0 = najszybszy provider dla danego zdarzenia.
          Brak punktu = ten provider nie przysłał danych dla tego zdarzenia.
        </p>
      </template>
    </div>
  </UCard>
</template>
