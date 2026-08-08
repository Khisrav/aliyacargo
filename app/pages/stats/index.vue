<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

interface StatsResponse {
  period: Period
  periodFrom: string | null
  periodTo: string | null
  totalCount: number
  totalWeight: number
  totalRevenue: number
  clientsCount: number
  clientsWithDebt: number
  paidCount: number
  unpaidCount: number
  paidRevenue: number
  unpaidRevenue: number
  paidWeight: number
  unpaidWeight: number
  paidRate: number
  acceptanceCount: number
  acceptanceWeight: number
  acceptanceCost: number
  wasteWeight: number
  otherIncome: number
  otherExpense: number
  net: number
  leftovers: Array<{
    id: number
    name: string
    phone: string
    unpaidCount: number
    unpaidRevenue: number
    unpaidWeight: number
  }>
  daily: Array<{
    date: string
    count: number
    weight: number
    revenue: number
    paidRevenue: number
  }>
}

const PERIOD_OPTIONS: { value: Period, label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all', label: 'Всё' },
  { value: 'custom', label: 'Свой' },
]

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartKey() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatNumber } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const stats = ref<StatsResponse | null>(null)
const period = ref<Period>('month')
const dateFrom = ref(monthStartKey())
const dateTo = ref(todayKey())

const maxDaily = computed(() => {
  if (!stats.value?.daily.length) return 1
  return Math.max(1, ...stats.value.daily.map(d => d.revenue))
})

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(period, () => {
  if (period.value !== 'custom') load()
})

watch([dateFrom, dateTo], () => {
  if (period.value === 'custom') load()
})

async function load() {
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    const params = new URLSearchParams({ period: period.value })
    if (period.value === 'custom') {
      if (dateFrom.value) params.set('dateFrom', dateFrom.value)
      if (dateTo.value) params.set('dateTo', dateTo.value)
    }
    stats.value = await apiFetch<StatsResponse>(`/api/stats?${params}`)
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить'
  }
}
</script>

<template>
  <div>
    <PageHeader title="Статистика" subtitle="Остатки и финансы" show-refresh :refreshing="state === 'loading'" @refresh="load" />

    <div class="space-y-4 px-4 pb-8">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="opt in PERIOD_OPTIONS"
          :key="opt.value"
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-extrabold transition"
          :class="period === opt.value ? 'bg-brand text-white' : 'ui-glass text-muted'"
          @click="period = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <div v-if="period === 'custom'" class="grid grid-cols-2 gap-3">
        <label class="ui-field">
          <span class="ui-label">С</span>
          <input v-model="dateFrom" type="date" class="ui-input">
        </label>
        <label class="ui-field">
          <span class="ui-label">По</span>
          <input v-model="dateTo" type="date" class="ui-input">
        </label>
      </div>

      <UiSpinner v-if="state === 'loading'" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

      <template v-else-if="stats">
        <NuxtLink to="/stats/acceptances" class="ui-card flex items-center gap-3 px-4 py-4 transition active:scale-[0.99]">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 to-brand text-white shadow-[0_8px_18px_rgba(13,148,136,0.28)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <path d="M3.3 7.5L12 12l8.7-4.5" />
              <path d="M12 12v9" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-extrabold text-ink">Готовность приёмок</p>
            <p class="text-xs font-medium text-muted">Сколько выкуплено по каждой партии</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="shrink-0 text-muted">
            <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </NuxtLink>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Остатки (неоплачено)</h2>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Шт</p>
              <p class="text-lg font-extrabold tabular-nums text-danger">{{ stats.unpaidCount }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Вес</p>
              <p class="text-lg font-extrabold tabular-nums">{{ formatWeight(stats.unpaidWeight) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Долг</p>
              <p class="text-lg font-extrabold tabular-nums text-danger">{{ formatPrice(stats.unpaidRevenue) }}</p>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Финансы периода</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Выручка (оплачено)</span>
              <span class="font-extrabold tabular-nums text-success">{{ formatPrice(stats.paidRevenue) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Закупки (приёмки)</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(stats.acceptanceCost) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Мусор, кг</span>
              <span class="font-extrabold tabular-nums">{{ formatWeight(stats.wasteWeight) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Прочие доходы</span>
              <span class="font-extrabold tabular-nums">{{ formatPrice(stats.otherIncome) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Прочие расходы</span>
              <span class="font-extrabold tabular-nums">{{ formatPrice(stats.otherExpense) }}</span>
            </div>
            <div class="flex justify-between border-t border-white/60 pt-2">
              <span class="font-bold text-ink">Чистыми</span>
              <span
                class="font-extrabold tabular-nums"
                :class="stats.net >= 0 ? 'text-success' : 'text-danger'"
              >
                {{ formatPrice(stats.net) }}
              </span>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Сортировка</h2>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Товаров</p>
              <p class="font-extrabold tabular-nums">{{ formatNumber(stats.totalCount) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Вес</p>
              <p class="font-extrabold tabular-nums">{{ formatWeight(stats.totalWeight) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Оплачено %</p>
              <p class="font-extrabold tabular-nums">{{ stats.paidRate }}%</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Приёмок</p>
              <p class="font-extrabold tabular-nums">{{ stats.acceptanceCount }}</p>
            </div>
          </div>
        </section>

        <section v-if="stats.daily.length" class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Выручка по дням</h2>
          <div class="flex h-32 items-end gap-1">
            <div
              v-for="d in stats.daily"
              :key="d.date"
              class="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              :title="`${d.date}: ${formatPrice(d.revenue)}`"
            >
              <div
                class="w-full rounded-t-md bg-gradient-to-t from-brand to-teal-300"
                :style="{ height: `${Math.max(4, (d.revenue / maxDaily) * 100)}%` }"
              />
            </div>
          </div>
        </section>

        <section v-if="stats.leftovers.length" class="space-y-2">
          <h2 class="px-1 text-sm font-extrabold text-ink">Топ должников</h2>
          <NuxtLink
            v-for="c in stats.leftovers"
            :key="c.id"
            :to="`/clients/${c.id}`"
            class="ui-card flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate font-extrabold text-ink">{{ c.name }}</p>
              <p class="text-xs text-muted">+992 {{ formatPhone(c.phone) }} · {{ c.unpaidCount }} шт</p>
            </div>
            <p class="shrink-0 font-extrabold tabular-nums text-danger">{{ formatPrice(c.unpaidRevenue) }}</p>
          </NuxtLink>
        </section>
      </template>
    </div>
  </div>
</template>
