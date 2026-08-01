<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all'

interface DayBucket {
  date: string
  count: number
  weight: number
  revenue: number
}

interface TopCustomer {
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
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all', label: 'Всё время' },
]

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const stats = ref<StatsResponse | null>(null)
const period = ref<Period>('month')

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
  }
})

const chartEmptyText = computed(() => {
  if (period.value === 'all') return 'За последние 14 дней записей нет'
  return 'За выбранный период записей нет'
})

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(period, () => {
  if (ready.value) load()
})

async function load() {
  if (!ready.value) return

  state.value = 'loading'
  try {
    const params = new URLSearchParams({ period: period.value })
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

function formatPrice(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'TJS', maximumFractionDigits: 0 }).format(n)
}

function formatWeight(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n) + ' кг'
}

function formatNumber(n: number, digits = 1) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(n)
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
  <div class="stats-page">
    <header class="header">
      <h1>Статистика</h1>
      <button class="refresh-btn" aria-label="Обновить" :disabled="state === 'loading'" @click="load">
        ↻
      </button>
    </header>

    <div class="period-bar" role="tablist" aria-label="Период">
      <button
        v-for="option in PERIOD_OPTIONS"
        :key="option.value"
        type="button"
        role="tab"
        class="period-chip"
        :class="{ active: period === option.value }"
        :aria-selected="period === option.value"
        @click="selectPeriod(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-if="state === 'loading'" class="screen center">
      <div class="spinner" />
      <p class="muted">Загрузка…</p>
    </div>

    <div v-else-if="state === 'error'" class="screen center">
      <div class="icon-block">⚠️</div>
      <h1>Ошибка</h1>
      <p class="muted">{{ errorMessage }}</p>
      <button class="retry-btn" @click="load">
        Повторить
      </button>
    </div>

    <template v-else-if="stats">
      <main class="main">
        <section class="cards-grid">
          <div class="stat-card">
            <span class="stat-label">Записей</span>
            <span class="stat-value">{{ stats.totalCount }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Клиентов</span>
            <span class="stat-value">{{ stats.customersCount }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Общий вес</span>
            <span class="stat-value">{{ formatWeight(stats.totalWeight) }}</span>
          </div>
          <div class="stat-card accent">
            <span class="stat-label">Общая сумма</span>
            <span class="stat-value">{{ formatPrice(stats.totalRevenue) }}</span>
          </div>
        </section>

        <section class="card leftovers-card">
          <h2 class="section-title">Остатки / долги</h2>
          <div class="leftover-summary">
            <div class="leftover-box">
              <span class="metric-label">Неоплачено</span>
              <span class="metric-value danger">{{ formatPrice(stats.unpaidRevenue) }}</span>
              <span class="muted">{{ stats.unpaidCount }} записей · {{ formatWeight(stats.unpaidWeight) }}</span>
            </div>
            <div class="leftover-box">
              <span class="metric-label">Должников</span>
              <span class="metric-value danger">{{ stats.customersWithDebt }}</span>
              <span class="muted">клиентов с остатком</span>
            </div>
          </div>

          <div v-if="stats.leftovers.length" class="top-list">
            <div v-for="(customer, index) in stats.leftovers" :key="`debt-${customer.phone}`" class="top-row">
              <span class="top-rank">{{ index + 1 }}</span>
              <div class="top-info">
                <span class="top-name">{{ customer.name }}</span>
                <span class="top-meta">
                  {{ formatPhone(customer.phone) }} · {{ customer.unpaidCount }} записей · {{ formatWeight(customer.weight) }}
                </span>
              </div>
              <span class="top-revenue danger">{{ formatPrice(customer.unpaidRevenue) }}</span>
            </div>
          </div>
          <p v-else class="muted empty-daily">Неоплаченных остатков нет</p>
        </section>

        <section class="card">
          <h2 class="section-title">Средние показатели</h2>
          <div class="metrics-grid">
            <div class="metric">
              <span class="metric-label">Средний вес</span>
              <span class="metric-value">{{ formatWeight(stats.avgWeight) }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Средняя цена</span>
              <span class="metric-value">{{ formatPrice(stats.avgPrice) }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Цена за кг</span>
              <span class="metric-value">{{ formatPrice(stats.avgPricePerKg) }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Мин / макс вес</span>
              <span class="metric-value">{{ formatNumber(stats.minWeight) }}–{{ formatNumber(stats.maxWeight) }} кг</span>
            </div>
          </div>
        </section>

        <section class="card breakdown-card">
          <h2 class="section-title">Оплата · {{ formatNumber(stats.paidRate, 0) }}%</h2>
          <div class="breakdown-row">
            <div class="breakdown-item paid">
              <span class="breakdown-dot" />
              <div class="breakdown-text">
                <span class="breakdown-title">Оплачено</span>
                <span class="breakdown-sub">
                  {{ stats.paidCount }} записей · {{ formatWeight(stats.paidWeight) }} · {{ formatPrice(stats.paidRevenue) }}
                </span>
              </div>
            </div>
            <div class="breakdown-item unpaid">
              <span class="breakdown-dot" />
              <div class="breakdown-text">
                <span class="breakdown-title">Не оплачено</span>
                <span class="breakdown-sub">
                  {{ stats.unpaidCount }} записей · {{ formatWeight(stats.unpaidWeight) }} · {{ formatPrice(stats.unpaidRevenue) }}
                </span>
              </div>
            </div>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${stats.totalCount ? (stats.paidCount / stats.totalCount) * 100 : 0}%` }"
            />
          </div>
        </section>

        <section class="card chart-card">
          <h2 class="section-title">{{ chartTitle }}</h2>
          <div class="chart" :class="{ dense: stats.daily.length > 14 }">
            <div v-for="day in stats.daily" :key="day.date" class="chart-col">
              <div class="chart-bar-wrap">
                <div
                  class="chart-bar"
                  :class="{ empty: day.revenue === 0 }"
                  :style="{ height: barHeight(day.revenue) }"
                  :title="`${formatDay(day.date)}: ${formatPrice(day.revenue)}`"
                />
              </div>
              <span class="chart-label">{{ formatDay(day.date) }}</span>
            </div>
          </div>
          <div class="daily-summary">
            <div v-for="day in stats.daily.filter(d => d.count > 0)" :key="`sum-${day.date}`" class="daily-row">
              <span>{{ formatDay(day.date) }}</span>
              <span>{{ day.count }} шт · {{ formatWeight(day.weight) }} · {{ formatPrice(day.revenue) }}</span>
            </div>
            <p v-if="!stats.daily.some(d => d.count > 0)" class="muted empty-daily">
              {{ chartEmptyText }}
            </p>
          </div>
        </section>

        <section class="card">
          <h2 class="section-title">Топ клиентов</h2>
          <div v-if="stats.topCustomers.length" class="top-list">
            <div v-for="(customer, index) in stats.topCustomers" :key="customer.phone" class="top-row">
              <span class="top-rank">{{ index + 1 }}</span>
              <div class="top-info">
                <span class="top-name">{{ customer.name }}</span>
                <span class="top-meta">
                  {{ formatPhone(customer.phone) }} · {{ customer.count }} записей · {{ formatWeight(customer.weight) }}
                </span>
              </div>
              <span class="top-revenue">{{ formatPrice(customer.revenue) }}</span>
            </div>
          </div>
          <p v-else class="muted empty-daily">Пока нет данных по клиентам</p>
        </section>
      </main>
    </template>
  </div>
</template>

<style scoped>
.stats-page {
  min-height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.screen {
  min-height: 50dvh;
  padding: 24px;
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}

.icon-block {
  font-size: 48px;
}

.retry-btn {
  padding: 10px 18px;
  border-radius: 12px;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  font-weight: 600;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 8px;
}

.header h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.refresh-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--tg-theme-secondary-bg-color, #eee);
  color: var(--tg-theme-text-color, #333);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-btn:disabled {
  opacity: 0.6;
}

.period-bar {
  display: flex;
  gap: 8px;
  padding: 4px 16px 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.period-bar::-webkit-scrollbar {
  display: none;
}

.period-chip {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--tg-theme-secondary-bg-color, #eee);
  color: var(--tg-theme-text-color, #333);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.period-chip.active {
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
}

.main {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-card {
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-card.accent {
  background: var(--tg-theme-button-color, #3390ec);
}

.stat-card.accent .stat-label,
.stat-card.accent .stat-value {
  color: var(--tg-theme-button-text-color, #fff);
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.card {
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-radius: 16px;
  padding: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 14px;
}

.leftover-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.leftover-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 12px;
  background: #fef2f2;
}

.top-list,
.daily-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.daily-row,
.top-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.daily-row {
  justify-content: space-between;
  gap: 12px;
}

.daily-row span:first-child {
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.daily-row span:last-child {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  text-align: right;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 12px;
  background: var(--tg-theme-bg-color, #f0f0f0);
}

.metric-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.metric-value {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.metric-value.danger,
.top-revenue.danger {
  color: #dc2626;
}

.breakdown-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.breakdown-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.breakdown-item.paid .breakdown-dot {
  background: #15803d;
}

.breakdown-item.unpaid .breakdown-dot {
  background: #dc2626;
}

.breakdown-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.breakdown-title {
  font-size: 14px;
  font-weight: 600;
}

.breakdown-sub {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
}

.progress-bar {
  height: 8px;
  border-radius: 4px;
  background: #dc2626;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #15803d;
  transition: width 0.3s ease;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 140px;
  margin-bottom: 14px;
}

.chart.dense {
  gap: 2px;
}

.chart.dense .chart-label {
  font-size: 8px;
  transform: rotate(-45deg);
  transform-origin: center top;
  margin-top: 4px;
}

.chart-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
  min-width: 0;
}

.chart-bar-wrap {
  flex: 1;
  display: flex;
  align-items: flex-end;
  width: 100%;
}

.chart-bar {
  width: 100%;
  min-height: 4px;
  border-radius: 4px 4px 0 0;
  background: var(--tg-theme-button-color, #3390ec);
}

.chart-bar.empty {
  background: var(--tg-theme-bg-color, #eee);
}

.chart-label {
  font-size: 9px;
  color: var(--tg-theme-hint-color, #888);
  white-space: nowrap;
}

.top-rank {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--tg-theme-bg-color, #f0f0f0);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.top-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.top-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-meta {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
}

.top-revenue {
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.empty-daily {
  text-align: center;
  padding: 4px 0;
}

.muted {
  color: var(--tg-theme-hint-color, #888);
  font-size: 14px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--tg-theme-hint-color, #ccc);
  border-top-color: var(--tg-theme-button-color, #3390ec);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
