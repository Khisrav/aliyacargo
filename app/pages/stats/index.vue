<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

interface StatsResponse {
  period: Period
  periodFrom: string | null
  periodTo: string | null
  debt: {
    count: number
    weight: number
    amount: number
    clients: number
    top: Array<{
      id: number
      name: string
      phone: string
      count: number
      weight: number
      amount: number
    }>
  }
  collected: { count: number, amount: number }
  purchases: { count: number, weight: number, amount: number }
  otherIncome: number
  otherExpense: number
  net: number
  daily: Array<{ date: string, amount: number }>
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
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dushanbe',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function monthStartKey() {
  const today = todayKey()
  return `${today.slice(0, 8)}01`
}

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const stats = ref<StatsResponse | null>(null)
const period = ref<Period>('month')
const dateFrom = ref(monthStartKey())
const dateTo = ref(todayKey())

const maxDaily = computed(() => {
  if (!stats.value?.daily.length) return 1
  return Math.max(1, ...stats.value.daily.map(d => d.amount))
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
    <PageHeader title="Статистика" subtitle="Долг и деньги за период" show-refresh :refreshing="state === 'loading'" @refresh="load" />

    <div class="space-y-4 px-4 pb-8">
      <UiSpinner v-if="state === 'loading' && !stats" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

      <template v-if="stats && state !== 'error'">
        <NuxtLink to="/stats/acceptances" class="ui-card flex items-center gap-3 px-4 py-4 transition active:scale-[0.99]">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 to-brand text-white shadow-[0_8px_18px_rgba(13,148,136,0.28)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <path d="M3.3 7.5L12 12l8.7-4.5" />
              <path d="M12 12v9" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-extrabold text-ink">Приёмки по оплате</p>
            <p class="text-xs font-medium text-muted">Сколько оплачено по каждой партии</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="shrink-0 text-muted">
            <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </NuxtLink>

        <section class="ui-card space-y-1 px-4 py-4">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-extrabold text-ink">Долг сейчас</h2>
            <span class="text-[11px] font-bold text-muted">за всё время</span>
          </div>
          <p class="text-2xl font-extrabold tabular-nums text-danger">{{ formatPrice(stats.debt.amount) }}</p>
          <p class="text-xs font-medium text-muted">
            {{ stats.debt.count }} шт · {{ formatWeight(stats.debt.weight) }} · {{ stats.debt.clients }} клиент.
          </p>
        </section>

        <div class="flex flex-wrap gap-2 pt-1">
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

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Деньги за период</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Собрано · {{ stats.collected.count }} шт</span>
              <span class="font-extrabold tabular-nums text-success">{{ formatPrice(stats.collected.amount) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Закупка · {{ stats.purchases.count }} приёмок</span>
              <span class="font-extrabold tabular-nums text-danger">−{{ formatPrice(stats.purchases.amount) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Прочие доходы</span>
              <span class="font-extrabold tabular-nums">{{ formatPrice(stats.otherIncome) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Прочие расходы</span>
              <span class="font-extrabold tabular-nums">−{{ formatPrice(stats.otherExpense) }}</span>
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
          <p class="text-[11px] font-medium text-muted">Собрано — по дате оплаты, закупка — по дате приёмки.</p>
        </section>

        <section v-if="stats.daily.length > 1" class="ui-card space-y-3 px-4 py-4">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-extrabold text-ink">Собрано по дням</h2>
            <span class="text-[11px] font-bold tabular-nums text-muted">макс. {{ formatPrice(maxDaily) }}</span>
          </div>

          <div class="flex h-32 items-end gap-1.5">
            <div
              v-for="d in stats.daily"
              :key="d.date"
              class="flex h-full min-w-0 flex-1 flex-col justify-end"
              :title="`${d.date}: ${formatPrice(d.amount)}`"
            >
              <div
                class="mx-auto w-full max-w-[2.5rem] rounded-t-md bg-gradient-to-t from-brand to-teal-300"
                :style="{ height: `${Math.max(4, (d.amount / maxDaily) * 100)}%` }"
              />
            </div>
          </div>

          <div class="flex gap-1.5">
            <span
              v-for="d in stats.daily"
              :key="d.date"
              class="min-w-0 flex-1 truncate text-center text-[10px] font-bold tabular-nums text-muted"
            >
              {{ d.date.slice(8) }}
            </span>
          </div>
        </section>

        <section v-if="stats.debt.top.length" class="space-y-2">
          <h2 class="px-1 text-sm font-extrabold text-ink">
            Должники
            <span class="font-medium text-muted">{{ stats.debt.top.length < stats.debt.clients ? `топ ${stats.debt.top.length} из ${stats.debt.clients}` : stats.debt.clients }}</span>
          </h2>
          <NuxtLink
            v-for="c in stats.debt.top"
            :key="c.id"
            :to="`/clients/${c.id}`"
            class="ui-card flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate font-extrabold text-ink">{{ c.name }}</p>
              <p class="text-xs text-muted">+992 {{ formatPhone(c.phone) }} · {{ c.count }} шт</p>
            </div>
            <p class="shrink-0 font-extrabold tabular-nums text-danger">{{ formatPrice(c.amount) }}</p>
          </NuxtLink>
        </section>
      </template>
    </div>
  </div>
</template>
