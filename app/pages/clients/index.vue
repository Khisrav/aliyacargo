<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'

interface CustomerListItem {
  id: number
  phone: string
  name: string
  created_at: string
  goodsCount: number
  totalWeight: number
  totalRevenue: number
  unpaidCount: number
  unpaidRevenue: number
  lastActivityAt: string | null
}

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const customers = ref<CustomerListItem[]>([])

const filtersOpen = ref(false)
const search = ref('')
const debtFilter = ref<'all' | 'with_debt' | 'no_debt' | 'no_goods'>('all')
const activityFrom = ref('')
const activityTo = ref('')
const minGoods = ref('')
const sort = ref<'name' | 'debt' | 'revenue' | 'goods' | 'recent'>('name')

const filtersActive = computed(() =>
  search.value.trim().length > 0
  || debtFilter.value !== 'all'
  || !!activityFrom.value
  || !!activityTo.value
  || !!minGoods.value
  || sort.value !== 'name',
)

let searchDebounce: ReturnType<typeof setTimeout> | undefined
const gated = ref(false)

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  gated.value = true
  await load()
}, { immediate: true })
watch([debtFilter, activityFrom, activityTo, minGoods, sort], () => {
  if (gated.value) load()
})
watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (gated.value) load()
  }, 300)
})

async function load() {
  if (!ready.value) return

  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    const params = new URLSearchParams()
    if (search.value.trim()) params.set('search', search.value.trim())
    if (debtFilter.value !== 'all') params.set('debt', debtFilter.value)
    if (activityFrom.value) params.set('activityFrom', activityFrom.value)
    if (activityTo.value) params.set('activityTo', activityTo.value)
    if (minGoods.value) params.set('minGoods', minGoods.value)
    if (sort.value !== 'name') params.set('sort', sort.value)

    const qs = params.toString()
    customers.value = await apiFetch<CustomerListItem[]>(qs ? `/api/customers?${qs}` : '/api/customers')
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить клиентов'
  }
}

function clearFilters() {
  search.value = ''
  debtFilter.value = 'all'
  activityFrom.value = ''
  activityTo.value = ''
  minGoods.value = ''
  sort.value = 'name'
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'TJS', maximumFractionDigits: 0 }).format(n)
}

function formatWeight(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n) + ' кг'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}
</script>

<template>
  <div class="clients-page">
    <header class="header">
      <h1>Клиенты</h1>
      <button class="refresh-btn" aria-label="Обновить" @click="load">
        ↻
      </button>
    </header>

    <main class="main">
      <section class="card filters-card">
        <button class="filters-toggle" type="button" @click="filtersOpen = !filtersOpen">
          <span>
            Фильтры
            <span v-if="filtersActive" class="filters-badge">активны</span>
          </span>
          <span class="chevron" :class="{ open: filtersOpen }">▾</span>
        </button>

        <div v-show="filtersOpen" class="filters-body">
          <label class="field">
            <span class="label">Поиск</span>
            <input
              v-model="search"
              type="text"
              autocomplete="off"
              placeholder="Имя или телефон"
            >
          </label>

          <div class="filter-row two">
            <label class="field">
              <span class="label">Долг</span>
              <select v-model="debtFilter">
                <option value="all">Все</option>
                <option value="with_debt">С долгом</option>
                <option value="no_debt">Без долга</option>
                <option value="no_goods">Без записей</option>
              </select>
            </label>
            <label class="field">
              <span class="label">Сортировка</span>
              <select v-model="sort">
                <option value="name">По имени</option>
                <option value="debt">По долгу</option>
                <option value="revenue">По сумме</option>
                <option value="goods">По кол-ву</option>
                <option value="recent">По активности</option>
              </select>
            </label>
          </div>

          <div class="filter-row two">
            <label class="field">
              <span class="label">Активность с</span>
              <input v-model="activityFrom" type="date">
            </label>
            <label class="field">
              <span class="label">Активность по</span>
              <input v-model="activityTo" type="date">
            </label>
          </div>

          <label class="field">
            <span class="label">Мин. записей</span>
            <input
              v-model="minGoods"
              type="number"
              min="0"
              inputmode="numeric"
              placeholder="0"
            >
          </label>

          <button v-if="filtersActive" class="clear-btn" @click="clearFilters">
            Очистить фильтры
          </button>
        </div>
      </section>

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

      <template v-else>
        <p class="count-line muted">
          Найдено: {{ customers.length }}
        </p>

        <ul v-if="customers.length" class="clients-list">
          <li v-for="customer in customers" :key="customer.id">
            <NuxtLink :to="`/clients/${customer.id}`" class="client-card">
              <div class="client-main">
                <span class="client-name">{{ customer.name }}</span>
                <span class="client-phone">{{ formatPhone(customer.phone) }}</span>
              </div>
              <div class="client-stats">
                <span>{{ customer.goodsCount }} записей · {{ formatWeight(customer.totalWeight) }}</span>
                <span class="client-revenue">{{ formatPrice(customer.totalRevenue) }}</span>
              </div>
              <div class="client-meta">
                <span>Посл. активность: {{ formatDate(customer.lastActivityAt) }}</span>
              </div>
              <div v-if="customer.unpaidCount" class="client-debt">
                Долг: {{ formatPrice(customer.unpaidRevenue) }} ({{ customer.unpaidCount }})
              </div>
              <span class="arrow">›</span>
            </NuxtLink>
          </li>
        </ul>

        <p v-else class="empty muted">
          {{ filtersActive ? 'Клиенты не найдены' : 'Клиентов пока нет' }}
        </p>
      </template>
    </main>
  </div>
</template>

<style scoped>
.clients-page {
  min-height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 16px);
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
}

.refresh-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--tg-theme-secondary-bg-color, #eee);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
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
}

.filters-card {
  overflow: hidden;
}

.filters-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  font-size: 15px;
  font-weight: 700;
}

.filters-badge {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  font-size: 11px;
}

.chevron {
  transition: transform 0.2s;
  color: var(--tg-theme-hint-color, #888);
}

.chevron.open {
  transform: rotate(180deg);
}

.filters-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 20px 20px;
}

.filter-row {
  display: flex;
  gap: 12px;
}

.filter-row.two > .field {
  flex: 1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #666);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.field input,
.field select {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: var(--tg-theme-bg-color, #f0f0f0);
  color: var(--tg-theme-text-color, #111);
  font-size: 15px;
}

.field input:focus,
.field select:focus {
  border-color: var(--tg-theme-button-color, #3390ec);
  outline: none;
}

.clear-btn {
  align-self: flex-start;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  background: var(--tg-theme-bg-color, #f0f0f0);
  color: var(--tg-theme-button-color, #3390ec);
}

.count-line {
  padding: 0 4px;
  font-size: 13px;
}

.clients-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.client-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 36px 14px 16px;
  border-radius: 14px;
  background: var(--tg-theme-secondary-bg-color, #fff);
  color: inherit;
  text-decoration: none;
}

.client-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.client-name {
  font-size: 16px;
  font-weight: 700;
}

.client-phone {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #888);
  font-variant-numeric: tabular-nums;
}

.client-stats {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
}

.client-revenue {
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
}

.client-meta {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}

.client-debt {
  font-size: 12px;
  font-weight: 600;
  color: #dc2626;
}

.arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 22px;
  color: var(--tg-theme-hint-color, #aaa);
}

.screen {
  min-height: 40dvh;
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
  padding: 24px;
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
