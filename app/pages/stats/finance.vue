<script setup lang="ts">
type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

interface FinanceRecordBrief {
  id: number
  type: 'income' | 'expense'
  amount: number
  note: string
  created_at: string
}

interface FinanceStatsResponse {
  period: Period
  periodFrom: string | null
  periodTo: string | null
  pricePerKg: number
  costPerKg: number
  marginPerKg: number
  goodsCount: number
  totalWeight: number
  paidCount: number
  paidWeight: number
  cargoRevenue: number
  cargoCost: number
  cargoMargin: number
  otherIncomeTotal: number
  otherExpenseTotal: number
  incomeTotal: number
  expenseTotal: number
  incomeCount: number
  expenseCount: number
  netProfit: number
  recentIncomes: FinanceRecordBrief[]
  recentExpenses: FinanceRecordBrief[]
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

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatDateTime } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const stats = ref<FinanceStatsResponse | null>(null)
const period = ref<Period>('month')
const dateFrom = ref(monthStartKey())
const dateTo = ref(todayKey())
const dateError = ref('')
const skipDateWatch = ref(false)

const customDatesValid = computed(() => {
  if (!dateFrom.value && !dateTo.value) return false
  if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) return false
  return true
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
    stats.value = await apiFetch<FinanceStatsResponse>(`/api/stats/finance?${params}`)
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить финансы'
  }
}

function selectPeriod(value: Period) {
  if (period.value === value) return
  period.value = value
}
</script>

<template>
  <div>
    <PageHeader title="Финансы" subtitle="Чистая прибыль" show-refresh :refreshing="state === 'loading'" @refresh="load">
      <template #actions>
        <NuxtLink to="/finance" class="ui-chip text-brand">
          Записи
        </NuxtLink>
      </template>
    </PageHeader>

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
        <div class="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-brand/25 blur-2xl" />
        <div class="pointer-events-none absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-accent/25 blur-2xl" />
        <p class="relative text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand">Чистая прибыль</p>
        <p
          class="relative mt-1 text-[2rem] font-extrabold leading-none tracking-tight tabular-nums"
          :class="stats.netProfit >= 0 ? 'text-ink' : 'text-danger'"
        >
          {{ formatPrice(stats.netProfit) }}
        </p>
        <p class="relative mt-2 text-xs font-medium text-muted">
          Все доходы − все расходы
        </p>
      </section>

      <UiStatGrid
        :items="[
          { label: 'Доходы всего', value: formatPrice(stats.incomeTotal), tone: 'accent' },
          { label: 'Расходы всего', value: formatPrice(stats.expenseTotal), tone: 'danger' },
          { label: 'Выручка груза', value: formatPrice(stats.cargoRevenue) },
          { label: 'Себест. груза', value: formatPrice(stats.cargoCost), tone: 'danger' },
        ]"
      />

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Склад в финансах</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-muted">Оплаченная выручка</span>
            <span class="font-extrabold tabular-nums text-success">+{{ formatPrice(stats.cargoRevenue) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">Себестоимость ({{ formatWeight(stats.totalWeight) }} × {{ formatPrice(stats.costPerKg) }})</span>
            <span class="font-extrabold tabular-nums text-danger">−{{ formatPrice(stats.cargoCost) }}</span>
          </div>
          <div class="flex justify-between gap-3 border-t border-white/50 pt-2">
            <span class="font-bold text-ink">Маржа груза</span>
            <span class="font-extrabold tabular-nums text-brand">{{ formatPrice(stats.cargoMargin) }}</span>
          </div>
        </div>
        <p class="text-xs text-muted">
          {{ formatWeight(stats.totalWeight) }} всего · {{ stats.paidCount }}/{{ stats.goodsCount }} оплачено · {{ formatPrice(stats.pricePerKg) }}/кг · себест. {{ formatPrice(stats.costPerKg) }}/кг
        </p>
      </section>

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Прочие операции</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-muted">Прочие доходы ({{ stats.incomeCount }})</span>
            <span class="font-extrabold tabular-nums text-success">+{{ formatPrice(stats.otherIncomeTotal) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">Прочие расходы ({{ stats.expenseCount }})</span>
            <span class="font-extrabold tabular-nums text-danger">−{{ formatPrice(stats.otherExpenseTotal) }}</span>
          </div>
        </div>
      </section>

      <section class="ui-card space-y-2 px-4 py-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-bold text-ink">Последние прочие доходы</h2>
          <span class="text-xs font-bold text-success">{{ stats.incomeCount }}</span>
        </div>
        <div v-if="stats.recentIncomes.length" class="space-y-1.5">
          <div
            v-for="item in stats.recentIncomes"
            :key="`in-${item.id}`"
            class="flex items-center gap-3 rounded-[1.15rem] border border-white/60 bg-white/40 px-3 py-2.5"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-ink">{{ item.note }}</p>
              <p class="text-[11px] text-muted">{{ formatDateTime(item.created_at) }}</p>
            </div>
            <span class="text-sm font-extrabold tabular-nums text-success">+{{ formatPrice(item.amount) }}</span>
          </div>
        </div>
        <p v-else class="text-center text-xs text-muted">Нет прочих доходов за период</p>
      </section>

      <section class="ui-card space-y-2 px-4 py-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-bold text-ink">Последние прочие расходы</h2>
          <span class="text-xs font-bold text-danger">{{ stats.expenseCount }}</span>
        </div>
        <div v-if="stats.recentExpenses.length" class="space-y-1.5">
          <div
            v-for="item in stats.recentExpenses"
            :key="`ex-${item.id}`"
            class="flex items-center gap-3 rounded-[1.15rem] border border-white/60 bg-white/40 px-3 py-2.5"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-ink">{{ item.note }}</p>
              <p class="text-[11px] text-muted">{{ formatDateTime(item.created_at) }}</p>
            </div>
            <span class="text-sm font-extrabold tabular-nums text-danger">−{{ formatPrice(item.amount) }}</span>
          </div>
        </div>
        <p v-else class="text-center text-xs text-muted">Нет прочих расходов за период</p>
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
