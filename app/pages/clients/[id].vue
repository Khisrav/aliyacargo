<script setup lang="ts">
import type { CustomerGood } from '~/composables/useTelegram'
import { formatPhone } from '#shared/utils/phone'

interface CustomerProfile {
  customer: {
    id: number
    phone: string
    name: string
    created_at: string
    updated_at: string
  }
  stats: {
    totalCount: number
    totalWeight: number
    totalRevenue: number
    paidCount: number
    unpaidCount: number
    paidRevenue: number
    unpaidRevenue: number
    paidWeight: number
    unpaidWeight: number
    avgWeight: number
    avgPrice: number
    paidRate: number
    firstAt: string | null
    lastAt: string | null
  }
  goods: CustomerGood[]
}

const route = useRoute()
const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const profile = ref<CustomerProfile | null>(null)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)
const paidFilter = ref<'all' | 'paid' | 'unpaid'>('all')
const gated = ref(false)

const customerId = computed(() => Number(route.params.id))

const filteredGoods = computed(() => {
  const goods = profile.value?.goods ?? []
  if (paidFilter.value === 'paid') return goods.filter(g => g.has_paid)
  if (paidFilter.value === 'unpaid') return goods.filter(g => !g.has_paid)
  return goods
})

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  gated.value = true
  await load()
}, { immediate: true })
watch(() => route.params.id, () => {
  if (gated.value) load()
})

async function load() {
  if (!ready.value || !Number.isFinite(customerId.value)) return

  state.value = 'loading'
  try {
    profile.value = await apiFetch<CustomerProfile>(`/api/customers/profile/${customerId.value}`)
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить клиента'
  }
}

async function togglePaid(item: CustomerGood) {
  try {
    const updated = await apiFetch<CustomerGood>(`/api/goods/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: !item.has_paid }),
    })

    if (!profile.value) return

    const idx = profile.value.goods.findIndex(g => g.id === item.id)
    if (idx !== -1) profile.value.goods[idx] = updated

    // Refresh aggregates lightly from current goods list
    const goods = profile.value.goods
    const paidRows = goods.filter(g => g.has_paid)
    const unpaidRows = goods.filter(g => !g.has_paid)
    profile.value.stats = {
      ...profile.value.stats,
      totalCount: goods.length,
      totalWeight: goods.reduce((s, g) => s + g.weight, 0),
      totalRevenue: goods.reduce((s, g) => s + g.price, 0),
      paidCount: paidRows.length,
      unpaidCount: unpaidRows.length,
      paidRevenue: paidRows.reduce((s, g) => s + g.price, 0),
      unpaidRevenue: unpaidRows.reduce((s, g) => s + g.price, 0),
      paidWeight: paidRows.reduce((s, g) => s + g.weight, 0),
      unpaidWeight: unpaidRows.reduce((s, g) => s + g.weight, 0),
      avgWeight: goods.length ? goods.reduce((s, g) => s + g.weight, 0) / goods.length : 0,
      avgPrice: goods.length ? goods.reduce((s, g) => s + g.price, 0) / goods.length : 0,
      paidRate: goods.length ? (paidRows.length / goods.length) * 100 : 0,
    }

    haptic('light')
  }
  catch (e) {
    toast.value = {
      type: 'error',
      message: e instanceof Error ? e.message : 'Не удалось обновить',
    }
    setTimeout(() => { toast.value = null }, 2500)
  }
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'TJS', maximumFractionDigits: 0 }).format(n)
}

function formatWeight(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n) + ' кг'
}

function formatNumber(n: number, digits = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(n)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="detail-page">
    <header class="header">
      <NuxtLink to="/clients" class="back-btn" aria-label="Назад">
        ‹
      </NuxtLink>
      <h1>Клиент</h1>
      <button class="refresh-btn" aria-label="Обновить" @click="load">
        ↻
      </button>
    </header>

    <div v-if="state === 'loading'" class="screen center">
      <div class="spinner" />
      <p class="muted">Загрузка…</p>
    </div>

    <div v-else-if="state === 'error'" class="screen center">
      <div class="icon-block">⚠️</div>
      <h2>Ошибка</h2>
      <p class="muted">{{ errorMessage }}</p>
      <button class="retry-btn" @click="load">
        Повторить
      </button>
    </div>

    <main v-else-if="profile" class="main">
      <section class="card identity">
        <h2 class="client-name">{{ profile.customer.name }}</h2>
        <p class="client-phone">+992 {{ formatPhone(profile.customer.phone) }}</p>
        <p class="muted">Клиент с {{ formatDate(profile.customer.created_at) }}</p>
      </section>

      <section class="cards-grid">
        <div class="stat-card">
          <span class="stat-label">Записей</span>
          <span class="stat-value">{{ profile.stats.totalCount }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Вес</span>
          <span class="stat-value">{{ formatWeight(profile.stats.totalWeight) }}</span>
        </div>
        <div class="stat-card accent">
          <span class="stat-label">Сумма</span>
          <span class="stat-value">{{ formatPrice(profile.stats.totalRevenue) }}</span>
        </div>
        <div class="stat-card danger">
          <span class="stat-label">Долг</span>
          <span class="stat-value">{{ formatPrice(profile.stats.unpaidRevenue) }}</span>
        </div>
      </section>

      <section class="card">
        <h3 class="section-title">Статистика</h3>
        <div class="metrics">
          <div class="metric-row">
            <span>Оплачено</span>
            <span>{{ profile.stats.paidCount }} · {{ formatPrice(profile.stats.paidRevenue) }}</span>
          </div>
          <div class="metric-row">
            <span>Не оплачено</span>
            <span>{{ profile.stats.unpaidCount }} · {{ formatPrice(profile.stats.unpaidRevenue) }}</span>
          </div>
          <div class="metric-row">
            <span>Оплата</span>
            <span>{{ formatNumber(profile.stats.paidRate, 0) }}%</span>
          </div>
          <div class="metric-row">
            <span>Средний вес</span>
            <span>{{ formatWeight(profile.stats.avgWeight) }}</span>
          </div>
          <div class="metric-row">
            <span>Средняя цена</span>
            <span>{{ formatPrice(profile.stats.avgPrice) }}</span>
          </div>
          <div class="metric-row">
            <span>Первая запись</span>
            <span>{{ formatDate(profile.stats.firstAt) }}</span>
          </div>
          <div class="metric-row">
            <span>Последняя запись</span>
            <span>{{ formatDate(profile.stats.lastAt) }}</span>
          </div>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${profile.stats.totalCount ? profile.stats.paidRate : 0}%` }"
          />
        </div>
      </section>

      <section class="history">
        <div class="history-header">
          <h3 class="section-title">История грузов</h3>
          <select v-model="paidFilter" class="filter-select">
            <option value="all">Все</option>
            <option value="paid">Оплачено</option>
            <option value="unpaid">Не оплачено</option>
          </select>
        </div>

        <ul v-if="filteredGoods.length" class="goods-list">
          <li v-for="item in filteredGoods" :key="item.id" class="goods-item">
            <div class="goods-info">
              <span class="goods-title">
                {{ formatWeight(item.weight) }} · {{ formatPrice(item.price) }}
              </span>
              <span class="goods-meta">{{ formatDateTime(item.created_at) }}</span>
              <span v-if="item.initiator" class="goods-meta">
                Оплату отметил: {{ item.initiator }}
              </span>
            </div>
            <button
              class="paid-btn"
              :class="{ paid: item.has_paid }"
              @click="togglePaid(item)"
            >
              {{ item.has_paid ? '✓ Оплачено' : 'Не оплачено' }}
            </button>
          </li>
        </ul>

        <p v-else class="empty muted">Записей нет</p>
      </section>
    </main>

    <Transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 16px 8px;
}

.header h1 {
  flex: 1;
  font-size: 20px;
  font-weight: 700;
}

.back-btn,
.refresh-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--tg-theme-secondary-bg-color, #eee);
  color: var(--tg-theme-text-color, #333);
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.refresh-btn {
  font-size: 20px;
}

.main {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-radius: 16px;
  padding: 16px;
}

.identity .client-name {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.client-phone {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px;
}

.cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stat-card {
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-card.accent {
  background: var(--tg-theme-button-color, #3390ec);
}

.stat-card.accent .stat-label,
.stat-card.accent .stat-value {
  color: var(--tg-theme-button-text-color, #fff);
}

.stat-card.danger {
  background: #fef2f2;
}

.stat-card.danger .stat-value {
  color: #dc2626;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
  text-transform: uppercase;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
}

.metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.metric-row span:first-child {
  color: var(--tg-theme-hint-color, #666);
}

.metric-row span:last-child {
  font-weight: 600;
  text-align: right;
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
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.history-header .section-title {
  margin-bottom: 0;
}

.filter-select {
  padding: 8px 10px;
  border-radius: 10px;
  border: none;
  background: var(--tg-theme-secondary-bg-color, #fff);
  font-size: 13px;
  font-weight: 600;
}

.goods-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goods-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--tg-theme-secondary-bg-color, #fff);
}

.goods-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.goods-title {
  font-size: 14px;
  font-weight: 700;
}

.goods-meta {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
}

.paid-btn {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  background: var(--tg-theme-bg-color, #f0f0f0);
  color: var(--tg-theme-hint-color, #888);
  white-space: nowrap;
}

.paid-btn.paid {
  background: #dcfce7;
  color: #15803d;
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
  font-size: 40px;
}

.retry-btn {
  padding: 10px 18px;
  border-radius: 12px;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  font-weight: 600;
}

.empty {
  text-align: center;
  padding: 20px;
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

.toast {
  position: fixed;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  left: 16px;
  right: 16px;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  z-index: 100;
}

.toast.error {
  background: #dc2626;
  color: #fff;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
