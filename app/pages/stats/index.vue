<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

interface DayBucket {
  date: string
  count: number
  weight: number
  revenue: number
}

interface TopCustomer {
  id: number
  name: string
  phone: string
  count: number
  weight: number
  revenue: number
  unpaidCount: number
  unpaidRevenue: number
}

interface StatsResponse {
  period: Period
  periodFrom: string | null
  periodTo: string | null
  totalCount: number
  totalWeight: number
  totalRevenue: number
  customersCount: number
  customersWithDebt: number
  paidCount: number
  unpaidCount: number
  paidRevenue: number
  unpaidRevenue: number
  paidWeight: number
  unpaidWeight: number
  avgWeight: number
  avgPrice: number
  avgPricePerKg: number
  paidRate: number
  maxWeight: number
  minWeight: number
  topCustomers: TopCustomer[]
  leftovers: TopCustomer[]
  daily: DayBucket[]
}

const PERIOD_OPTIONS: { value: Period, label: string }[] = [
  { value: 'custom', label: 'Свой' },
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all', label: 'Всё время' },
]

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartKey() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function formatRangeLabel(from: string | null, to: string | null) {
  const fmt = (value: string) => {
    const d = new Date(`${value}T00:00:00`)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  if (from && to) return `${fmt(from)} – ${fmt(to)}`
  if (from) return `с ${fmt(from)}`
  if (to) return `по ${fmt(to)}`
  return 'Свой период'
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
const dateError = ref('')
const skipDateWatch = ref(false)

const maxDailyRevenue = computed(() => {
  if (!stats.value) return 0
  return Math.max(1, ...stats.value.daily.map(d => d.revenue))
})

const chartTitle = computed(() => {
  switch (period.value) {
    case 'today':
      return 'Сегодня'
    case 'yesterday':
      return 'Вчера'
    case 'week':
      return 'Эта неделя'
    case 'month':
      return 'Этот месяц'
    case 'all':
      return 'Последние 14 дней'
    case 'custom':
      return formatRangeLabel(stats.value?.periodFrom ?? dateFrom.value, stats.value?.periodTo ?? dateTo.value)
  }
})

const chartEmptyText = computed(() => {
  if (period.value === 'all') return 'За последние 14 дней записей нет'
  return 'За выбранный период записей нет'
})

const customDatesValid = computed(() => {
  if (!dateFrom.value && !dateTo.value) return false
  if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) return false
  return true
})

const kpiItems = computed(() => {
  if (!stats.value) return []
  return [
    { label: 'Записей', value: stats.value.totalCount },
    { label: 'Клиентов', value: stats.value.customersCount },
    { label: 'Общий вес', value: formatWeight(stats.value.totalWeight) },
    { label: 'Начислено', value: formatPrice(stats.value.totalRevenue), tone: 'accent' as const },
  ]
})

const profitShare = computed(() => {
  if (!stats.value?.totalRevenue) return 0
  return Math.round((stats.value.paidRevenue / stats.value.totalRevenue) * 100)
})

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(period, async (value) => {
  if (!ready.value) return

  if (value === 'custom') {
    skipDateWatch.value = true
    if (!dateFrom.value) dateFrom.value = monthStartKey()
    if (!dateTo.value) dateTo.value = todayKey()
    await nextTick()
    skipDateWatch.value = false
  }

  await load()
})

watch([dateFrom, dateTo], () => {
  if (skipDateWatch.value || period.value !== 'custom' || !ready.value) return
  dateError.value = ''
  if (!customDatesValid.value) {
    if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
      dateError.value = 'Дата «с» не может быть позже даты «по»'
    }
    return
  }
  load()
})

async function load() {
  if (!ready.value) return
  if (period.value === 'custom' && !customDatesValid.value) return

  state.value = 'loading'
  dateError.value = ''
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
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить статистику'
  }
}

function selectPeriod(value: Period) {
  if (period.value === value) return
  period.value = value
}

function formatDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function barHeight(revenue: number) {
  const pct = Math.max(4, Math.round((revenue / maxDailyRevenue.value) * 100))
  return `${pct}%`
}
</script>

<template>
  <div>
    <PageHeader title="Склад" subtitle="Складская статистика" show-refresh :refreshing="state === 'loading'" @refresh="load" />

    <div
      class="sticky z-30 px-4 pb-3 pt-1"
      :style="{ top: 'env(safe-area-inset-top, 0px)' }"
    >
      <div class="ui-glass-strong flex gap-1.5 overflow-x-auto rounded-3xl p-1.5 scrollbar-none" role="tablist" aria-label="Период">
        <button
          v-for="option in PERIOD_OPTIONS"
          :key="option.value"
          type="button"
          role="tab"
          class="shrink-0 rounded-full px-3.5 py-2 text-xs font-extrabold transition duration-200 ease-expressive"
          :class="period === option.value ? 'ui-chip-active' : 'text-muted'"
          :aria-selected="period === option.value"
          @click="selectPeriod(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="period === 'custom'" class="space-y-2 px-4 pb-3">
      <div class="grid grid-cols-2 gap-3">
        <label class="ui-field">
          <span class="ui-label">Дата с</span>
          <input v-model="dateFrom" type="date" class="ui-input">
        </label>
        <label class="ui-field">
          <span class="ui-label">Дата по</span>
          <input v-model="dateTo" type="date" class="ui-input">
        </label>
      </div>
      <p v-if="dateError" class="text-xs font-bold text-danger">{{ dateError }}</p>
    </div>

    <UiSpinner v-if="state === 'loading'" />
    <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

    <main v-else-if="stats" class="space-y-4 px-4 pb-6">
      <section class="ui-card relative overflow-hidden px-4 py-5">
        <div class="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-brand/20 blur-2xl" />
        <div class="pointer-events-none absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />
        <p class="relative text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand">Получено</p>
        <p class="relative mt-1 text-[2rem] font-extrabold leading-none tracking-tight tabular-nums text-ink">
          {{ formatPrice(stats.paidRevenue) }}
        </p>
        <p class="relative mt-2 text-xs font-medium text-muted">
          Оплачено клиентами · {{ stats.paidCount }} записей · не чистая прибыль
        </p>
        <div class="relative mt-4 grid grid-cols-2 gap-2.5">
          <div class="rounded-[1.15rem] border border-white/60 bg-white/45 px-3 py-2.5">
            <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Начислено</p>
            <p class="mt-0.5 text-sm font-extrabold tabular-nums text-ink">{{ formatPrice(stats.totalRevenue) }}</p>
          </div>
          <div class="rounded-[1.15rem] border border-white/60 bg-white/45 px-3 py-2.5">
            <p class="text-[10px] font-bold uppercase tracking-wide text-muted">В долге</p>
            <p class="mt-0.5 text-sm font-extrabold tabular-nums text-danger">{{ formatPrice(stats.unpaidRevenue) }}</p>
          </div>
        </div>
        <div class="relative mt-3">
          <div class="mb-1.5 flex items-center justify-between text-[11px] font-bold text-muted">
            <span>Собрано</span>
            <span>{{ profitShare }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-white/50">
            <div
              class="h-full rounded-full bg-gradient-to-r from-teal-400 to-brand transition-all"
              :style="{ width: `${profitShare}%` }"
            />
          </div>
        </div>
      </section>

      <UiStatGrid :items="kpiItems" />

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Остатки / долги</h2>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="rounded-2xl bg-danger-soft px-3 py-3">
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">Неоплачено</p>
            <p class="mt-1 text-lg font-extrabold tabular-nums text-danger">{{ formatPrice(stats.unpaidRevenue) }}</p>
            <p class="mt-1 text-[11px] text-muted">{{ stats.unpaidCount }} зап. · {{ formatWeight(stats.unpaidWeight) }}</p>
          </div>
          <div class="rounded-2xl bg-danger-soft px-3 py-3">
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">Должников</p>
            <p class="mt-1 text-lg font-extrabold tabular-nums text-danger">{{ stats.customersWithDebt }}</p>
            <p class="mt-1 text-[11px] text-muted">клиентов с остатком</p>
          </div>
        </div>

        <div v-if="stats.leftovers.length" class="space-y-1.5">
          <NuxtLink
            v-for="(customer, index) in stats.leftovers"
            :key="`debt-${customer.phone}`"
            :to="`/clients/${customer.id}`"
            class="flex items-center gap-3 rounded-[1.25rem] border border-white/60 bg-white/40 px-3 py-3 transition active:scale-[0.99]"
          >
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-200 to-danger text-xs font-extrabold text-white">{{ index + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-ink">{{ customer.name }}</p>
              <p class="truncate text-[11px] text-muted">
                {{ formatPhone(customer.phone) }} · {{ customer.unpaidCount }} зап.
              </p>
            </div>
            <span class="text-sm font-extrabold tabular-nums text-danger">{{ formatPrice(customer.unpaidRevenue) }}</span>
          </NuxtLink>
        </div>
        <p v-else class="text-center text-xs text-muted">Неоплаченных остатков нет</p>
      </section>

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Средние показатели</h2>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-xs text-muted">Средний вес</p>
            <p class="font-extrabold">{{ formatWeight(stats.avgWeight) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted">Средняя цена</p>
            <p class="font-extrabold">{{ formatPrice(stats.avgPrice) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted">Цена за кг</p>
            <p class="font-extrabold">{{ formatPrice(stats.avgPricePerKg) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted">Мин / макс</p>
            <p class="font-extrabold">{{ formatNumber(stats.minWeight) }}–{{ formatNumber(stats.maxWeight) }} кг</p>
          </div>
        </div>
      </section>

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Оплата · {{ formatNumber(stats.paidRate, 0) }}%</h2>
        <div class="space-y-2 text-sm">
          <div class="flex items-start gap-2">
            <span class="mt-1.5 h-2 w-2 rounded-full bg-success" />
            <div>
              <p class="font-bold">Оплачено</p>
              <p class="text-xs text-muted">{{ stats.paidCount }} · {{ formatWeight(stats.paidWeight) }} · {{ formatPrice(stats.paidRevenue) }}</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <span class="mt-1.5 h-2 w-2 rounded-full bg-danger" />
            <div>
              <p class="font-bold">Не оплачено</p>
              <p class="text-xs text-muted">{{ stats.unpaidCount }} · {{ formatWeight(stats.unpaidWeight) }} · {{ formatPrice(stats.unpaidRevenue) }}</p>
            </div>
          </div>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-surface">
          <div
            class="h-full rounded-full bg-brand transition-all"
            :style="{ width: `${stats.totalCount ? (stats.paidCount / stats.totalCount) * 100 : 0}%` }"
          />
        </div>
      </section>

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">{{ chartTitle }}</h2>
        <div
          class="flex h-36 items-end gap-1 overflow-x-auto pb-1"
          :class="{ 'gap-0.5': stats.daily.length > 14 }"
        >
          <div
            v-for="day in stats.daily"
            :key="day.date"
            class="flex min-w-[18px] flex-1 flex-col items-center gap-1"
          >
            <div class="flex h-28 w-full items-end justify-center">
              <div
                class="w-full max-w-[18px] rounded-t-md transition-all"
                :class="day.revenue === 0 ? 'bg-line' : 'bg-brand'"
                :style="{ height: barHeight(day.revenue) }"
                :title="`${formatDay(day.date)}: ${formatPrice(day.revenue)}`"
              />
            </div>
            <span class="text-[9px] font-medium text-muted">{{ formatDay(day.date) }}</span>
          </div>
        </div>
        <div class="space-y-1.5">
          <div
            v-for="day in stats.daily.filter(d => d.count > 0)"
            :key="`sum-${day.date}`"
            class="flex justify-between gap-3 text-xs"
          >
            <span class="font-medium text-muted">{{ formatDay(day.date) }}</span>
            <span class="font-bold text-ink">{{ day.count }} шт · {{ formatWeight(day.weight) }} · {{ formatPrice(day.revenue) }}</span>
          </div>
          <p v-if="!stats.daily.some(d => d.count > 0)" class="text-center text-xs text-muted">
            {{ chartEmptyText }}
          </p>
        </div>
      </section>

      <section class="ui-card space-y-2 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Топ клиентов</h2>
        <div v-if="stats.topCustomers.length" class="space-y-1.5">
          <NuxtLink
            v-for="(customer, index) in stats.topCustomers"
            :key="customer.phone"
            :to="`/clients/${customer.id}`"
            class="flex items-center gap-3 rounded-[1.25rem] border border-white/60 bg-white/40 px-3 py-3 transition active:scale-[0.99]"
          >
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-300 to-brand text-xs font-extrabold text-white">{{ index + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-ink">{{ customer.name }}</p>
              <p class="truncate text-[11px] text-muted">
                {{ formatPhone(customer.phone) }} · {{ customer.count }} зап. · {{ formatWeight(customer.weight) }}
              </p>
            </div>
            <span class="text-sm font-extrabold tabular-nums text-brand">{{ formatPrice(customer.revenue) }}</span>
          </NuxtLink>
        </div>
        <p v-else class="text-center text-xs text-muted">Пока нет данных по клиентам</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
