<script setup lang="ts">
interface DayBucket {
  date: string
  count: number
  weight: number
  revenue: number
}

interface StatsResponse {
  totalCount: number
  totalWeight: number
  totalRevenue: number
  paidCount: number
  unpaidCount: number
  paidRevenue: number
  unpaidRevenue: number
  daily: DayBucket[]
}

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const stats = ref<StatsResponse | null>(null)

const maxDailyRevenue = computed(() => {
  if (!stats.value) return 0
  return Math.max(1, ...stats.value.daily.map(d => d.revenue))
})

watch(ready, load, { immediate: true })

async function load() {
  if (!ready.value) return

  state.value = 'loading'
  try {
    stats.value = await apiFetch<StatsResponse>('/api/stats')
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить статистику'
  }
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'TJS', maximumFractionDigits: 0 }).format(n)
}

function formatWeight(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n) + ' кг'
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
      <header class="header">
        <h1>Статистика</h1>
        <button class="refresh-btn" aria-label="Обновить" @click="load">
          ↻
        </button>
      </header>

      <main class="main">
        <section class="cards-grid">
          <div class="stat-card">
            <span class="stat-label">Всего записей</span>
            <span class="stat-value">{{ stats.totalCount }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Общий вес</span>
            <span class="stat-value">{{ formatWeight(stats.totalWeight) }}</span>
          </div>
          <div class="stat-card wide accent">
            <span class="stat-label">Общая сумма</span>
            <span class="stat-value">{{ formatPrice(stats.totalRevenue) }}</span>
          </div>
        </section>

        <section class="card breakdown-card">
          <h2 class="section-title">Оплата</h2>
          <div class="breakdown-row">
            <div class="breakdown-item paid">
              <span class="breakdown-dot" />
              <div class="breakdown-text">
                <span class="breakdown-title">Оплачено</span>
                <span class="breakdown-sub">{{ stats.paidCount }} записей · {{ formatPrice(stats.paidRevenue) }}</span>
              </div>
            </div>
            <div class="breakdown-item unpaid">
              <span class="breakdown-dot" />
              <div class="breakdown-text">
                <span class="breakdown-title">Не оплачено</span>
                <span class="breakdown-sub">{{ stats.unpaidCount }} записей · {{ formatPrice(stats.unpaidRevenue) }}</span>
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
          <h2 class="section-title">Последние 14 дней</h2>
          <div class="chart">
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
  min-height: 60dvh;
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

.stat-card.wide {
  grid-column: 1 / -1;
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
  font-size: 24px;
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
}

.chart-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
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
