<script setup lang="ts">
import type { CustomerGood } from '~/composables/useTelegram'
import { formatPhone } from '#shared/utils/phone'

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const goods = ref<CustomerGood[]>([])
const loadingGoods = ref(false)
const exporting = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)

const filtersOpen = ref(true)
const search = ref('')
const paidFilter = ref<'all' | 'paid' | 'unpaid'>('all')
const dateFrom = ref('')
const dateTo = ref('')
const filtersActive = computed(() =>
  search.value.trim().length > 0 || paidFilter.value !== 'all' || !!dateFrom.value || !!dateTo.value,
)

let searchDebounce: ReturnType<typeof setTimeout> | undefined

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })
watch([paidFilter, dateFrom, dateTo], () => {
  if (state.value === 'ok') load()
})
watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (state.value === 'ok' || state.value === 'error') load()
  }, 300)
})

function buildQuery() {
  const params = new URLSearchParams()
  if (search.value.trim()) params.set('search', search.value.trim())
  if (paidFilter.value !== 'all') params.set('paid', paidFilter.value)
  if (dateFrom.value) params.set('dateFrom', dateFrom.value)
  if (dateTo.value) params.set('dateTo', dateTo.value)
  const qs = params.toString()
  return qs ? `/api/goods?${qs}` : '/api/goods'
}

async function load() {
  if (!ready.value) return

  loadingGoods.value = true
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    goods.value = await apiFetch<CustomerGood[]>(buildQuery())
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить записи'
  }
  finally {
    loadingGoods.value = false
  }
}

function clearFilters() {
  search.value = ''
  paidFilter.value = 'all'
  dateFrom.value = ''
  dateTo.value = ''
}

function buildExportQuery() {
  const params = new URLSearchParams()
  if (dateFrom.value) params.set('dateFrom', dateFrom.value)
  if (dateTo.value) params.set('dateTo', dateTo.value)
  const qs = params.toString()
  return qs ? `/api/goods/export?${qs}` : '/api/goods/export'
}

function formatExportRows(rows: CustomerGood[]) {
  return rows
    .map((item, index) => {
      return `${index + 1}. ${item.name} — ${formatPhone(item.phone)} — ${item.weight} кг — ${item.price} с.`
    })
    .join('\n')
}

async function copyExport() {
  exporting.value = true
  try {
    if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
      throw new Error('Дата начала не может быть позже даты окончания')
    }

    const rows = await apiFetch<CustomerGood[]>(buildExportQuery())
    if (!rows.length) throw new Error('За выбранный период записей нет')

    const text = formatExportRows(rows)
    try {
      await navigator.clipboard.writeText(text)
    }
    catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }

    showToast('success', 'Данные скопированы')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось скопировать')
  }
  finally {
    exporting.value = false
  }
}

async function togglePaid(item: CustomerGood) {
  try {
    const updated = await apiFetch<CustomerGood>(`/api/goods/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: !item.has_paid }),
    })
    const idx = goods.value.findIndex(g => g.id === item.id)
    if (idx !== -1) goods.value[idx] = updated
    haptic('light')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось обновить')
  }
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'TJS', maximumFractionDigits: 0 }).format(n)
}

function formatWeight(n: number) {
  return `${n} кг`
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
</script>

<template>
  <div class="goods-page">
    <header class="header">
      <h1>Записи</h1>
      <button class="refresh-btn" aria-label="Обновить" :disabled="loadingGoods" @click="load">
        ↻
      </button>
    </header>

    <main class="main">
      <section class="card filters-card">
        <button class="filters-toggle" type="button" @click="filtersOpen = !filtersOpen">
          <span>
            Фильтры и экспорт
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

          <div class="filter-row">
            <label class="field">
              <span class="label">Статус оплаты</span>
              <select v-model="paidFilter">
                <option value="all">Все</option>
                <option value="paid">Оплачено</option>
                <option value="unpaid">Не оплачено</option>
              </select>
            </label>
          </div>

          <div class="filter-row two">
            <label class="field">
              <span class="label">Дата с</span>
              <input v-model="dateFrom" type="date">
            </label>
            <label class="field">
              <span class="label">Дата по</span>
              <input v-model="dateTo" type="date">
            </label>
          </div>

          <div class="export-block">
            <span class="export-title">Экспорт за выбранный период</span>
            <button class="export-btn" :disabled="exporting" @click="copyExport">
              {{ exporting ? 'Копирование…' : 'Копировать список' }}
            </button>
          </div>

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
          Найдено: {{ goods.length }}
          <span v-if="loadingGoods"> · обновление…</span>
        </p>

        <ul v-if="goods.length" class="goods-list">
          <li v-for="item in goods" :key="item.id" class="goods-item">
            <div class="goods-info">
              <span class="goods-name">{{ item.name }}</span>
              <span class="goods-meta">
                <span class="badge">{{ formatPhone(item.phone) }}</span>
                {{ formatWeight(item.weight) }} · {{ formatPrice(item.price) }}
                · {{ formatDateTime(item.created_at) }}
              </span>
              <span v-if="item.initiator" class="goods-initiator">
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

        <p v-else class="empty muted">
          {{ filtersActive ? 'Ничего не найдено по заданным фильтрам.' : 'Записей пока нет.' }}
        </p>
      </template>
    </main>

    <Transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.goods-page {
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

.export-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-title {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
}

.export-btn {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  font-size: 14px;
  font-weight: 700;
}

.export-btn:disabled {
  opacity: 0.5;
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
  gap: 4px;
}

.goods-name {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goods-meta {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
}

.goods-initiator {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}

.badge {
  display: inline-block;
  background: var(--tg-theme-bg-color, #eee);
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 700;
  margin-right: 4px;
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
  min-height: 30dvh;
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

.toast.success {
  background: #15803d;
  color: #fff;
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
