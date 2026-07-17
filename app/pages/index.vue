<script setup lang="ts">
import type { CustomerGood } from '~/composables/useTelegram'

const { initData, ready, isTelegram, haptic } = useTelegram()
const { apiFetch } = useApi(initData)

const authState = ref<'loading' | 'ok' | 'denied' | 'error'>('loading')
const authError = ref('')
const pricePerKg = ref(1000)
const userName = ref('')

const name = ref('')
const code = ref('')
const weight = ref('')

const submitting = ref(false)
const loadingGoods = ref(false)
const exporting = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)
const goods = ref<CustomerGood[]>([])

const search = ref('')
const paidFilter = ref<'all' | 'paid' | 'unpaid'>('all')
const dateFrom = ref('')
const dateTo = ref('')
const filtersActive = computed(() =>
  search.value.trim().length > 0 || paidFilter.value !== 'all' || !!dateFrom.value || !!dateTo.value,
)

const nameRef = ref<HTMLInputElement>()
const codeRef = ref<HTMLInputElement>()
const weightRef = ref<HTMLInputElement>()

let searchDebounce: ReturnType<typeof setTimeout> | undefined

const weightNum = computed(() => parseFloat(weight.value.replace(',', '.')) || 0)
const calculatedPrice = computed(() => Math.round(weightNum.value * pricePerKg.value * 100) / 100)

const canSubmit = computed(() =>
  name.value.trim().length > 0
  && /^\d{4}$/.test(code.value)
  && weightNum.value > 0
  && !submitting.value,
)

watch(ready, checkAuth, { immediate: true })
watch([paidFilter, dateFrom, dateTo], loadGoods)
watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(loadGoods, 300)
})

async function checkAuth() {
  if (!ready.value) return

  if (!initData.value && !import.meta.dev) {
    authState.value = 'denied'
    authError.value = isTelegram.value
      ? 'Не удалось получить сессию Telegram. Закройте и снова откройте приложение.'
      : 'Откройте это приложение через Telegram-бота.'
    return
  }

  try {
    const res = await apiFetch<{ ok: boolean, pricePerKg: number, user: { first_name: string } }>(
      '/api/auth/check',
      { method: 'POST' },
    )
    pricePerKg.value = res.pricePerKg
    userName.value = res.user.first_name
    authState.value = 'ok'
    await loadGoods()
    nextTick(() => nameRef.value?.focus())
  }
  catch (e) {
    authState.value = 'denied'
    authError.value = e instanceof Error ? e.message : 'Доступ запрещён'
  }
}

function buildQuery() {
  const params = new URLSearchParams()
  if (search.value.trim()) params.set('search', search.value.trim())
  if (paidFilter.value !== 'all') params.set('paid', paidFilter.value)
  if (dateFrom.value) params.set('dateFrom', dateFrom.value)
  if (dateTo.value) params.set('dateTo', dateTo.value)
  const qs = params.toString()
  return qs ? `/api/goods?${qs}` : '/api/goods'
}

async function loadGoods() {
  loadingGoods.value = true
  try {
    goods.value = await apiFetch<CustomerGood[]>(buildQuery())
  }
  catch {
    // non-blocking
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
      const itemCode = String(item.code).padStart(4, '0')
      return `${index + 1}. ${item.name}-${itemCode}, ${item.weight} | ${item.price}`
    })
    .join('\n')
}

async function getExportText() {
  if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
    throw new Error('Дата начала не может быть позже даты окончания')
  }

  const rows = await apiFetch<CustomerGood[]>(buildExportQuery())
  if (!rows.length) {
    throw new Error('За выбранный период записей нет')
  }

  return formatExportRows(rows)
}

async function copyExport() {
  exporting.value = true
  try {
    const text = await getExportText()

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

async function downloadExport() {
  exporting.value = true
  try {
    const text = await getExportText()
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aliya-cargo-${dateFrom.value || 'all'}-${dateTo.value || 'all'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось скачать файл')
  }
  finally {
    exporting.value = false
  }
}

async function printExport() {
  exporting.value = true
  try {
    const text = await getExportText()
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const printDocument = iframe.contentDocument
    if (!printDocument) throw new Error('Не удалось открыть печать')

    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    printDocument.open()
    printDocument.write(`<!doctype html><html lang="ru"><head><title>Aliya Cargo</title><style>body{font:16px/1.6 sans-serif;padding:24px;white-space:pre-wrap}h1{font-size:20px;margin:0 0 16px}</style></head><body><h1>Aliya Cargo</h1>${escapedText}</body></html>`)
    printDocument.close()

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 1000)
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось открыть печать')
  }
  finally {
    exporting.value = false
  }
}

function onCodeInput(e: Event) {
  const input = e.target as HTMLInputElement
  code.value = input.value.replace(/\D/g, '').slice(0, 4)
  input.value = code.value
  if (code.value.length === 4) {
    weightRef.value?.focus()
  }
}

function onWeightInput(e: Event) {
  const input = e.target as HTMLInputElement
  let val = input.value.replace(',', '.').replace(/[^\d.]/g, '')
  const parts = val.split('.')
  if (parts.length > 2) val = `${parts[0]}.${parts.slice(1).join('')}`
  weight.value = val
  input.value = val
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

function resetForm() {
  name.value = ''
  code.value = ''
  weight.value = ''
  nextTick(() => nameRef.value?.focus())
}

async function submit() {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    const item = await apiFetch<CustomerGood>('/api/goods', {
      method: 'POST',
      body: JSON.stringify({
        name: name.value.trim(),
        code: code.value,
        weight: weightNum.value,
      }),
    })
    if (!filtersActive.value) goods.value.unshift(item)
    showToast('success', `Сохранено · ${item.name} · ${formatPrice(item.price)}`)
    resetForm()
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось сохранить')
  }
  finally {
    submitting.value = false
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

function formatPrice(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'TJS', maximumFractionDigits: 0 }).format(n)
}

function formatWeight(n: number) {
  return `${n} кг`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function onNameEnter() {
  codeRef.value?.focus()
}

function onCodeEnter() {
  if (code.value.length === 4) weightRef.value?.focus()
}

function onWeightEnter() {
  if (canSubmit.value) submit()
}
</script>

<template>
  <div class="app">
    <!-- Loading -->
    <div v-if="authState === 'loading'" class="screen center">
      <div class="spinner" />
      <p class="muted">Загрузка…</p>
    </div>

    <!-- Denied -->
    <div v-else-if="authState === 'denied'" class="screen center">
      <div class="icon-block">🔒</div>
      <h1>Доступ запрещён</h1>
      <p class="muted">{{ authError }}</p>
    </div>

    <!-- Main app -->
    <template v-else>
      <header class="header">
        <div>
          <h1>Взвешивание</h1>
          <p v-if="userName" class="greeting">Привет, {{ userName }}</p>
        </div>
        <button class="refresh-btn" aria-label="Обновить список" @click="loadGoods">
          ↻
        </button>
      </header>

      <main class="main">
        <!-- Entry form -->
        <section class="card form-card">
          <label class="field">
            <span class="label">Имя клиента</span>
            <input
              ref="nameRef"
              v-model="name"
              type="text"
              autocomplete="off"
              autocapitalize="words"
              enterkeyhint="next"
              placeholder="Полное имя"
              @keydown.enter.prevent="onNameEnter"
            >
          </label>

          <label class="field">
            <span class="label">Код <span class="hint">4 цифры</span></span>
            <input
              ref="codeRef"
              :value="code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="4"
              autocomplete="off"
              enterkeyhint="next"
              placeholder="0000"
              class="code-input"
              @input="onCodeInput"
              @keydown.enter.prevent="onCodeEnter"
            >
          </label>

          <label class="field">
            <span class="label">Вес (кг)</span>
            <input
              ref="weightRef"
              :value="weight"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              enterkeyhint="done"
              placeholder="0.0"
              class="weight-input"
              @input="onWeightInput"
              @keydown.enter.prevent="onWeightEnter"
            >
          </label>

          <div class="price-row" :class="{ active: weightNum > 0 }">
            <span class="price-label">Цена</span>
            <span class="price-value">{{ formatPrice(calculatedPrice) }}</span>
          </div>

          <button
            class="submit-btn"
            :class="{ ready: canSubmit }"
            :disabled="!canSubmit"
            @click="submit"
          >
            {{ submitting ? 'Сохранение…' : 'Сохранить и далее' }}
          </button>
        </section>

        <!-- Filters -->
        <section class="card filters-card">
          <label class="field">
            <span class="label">Поиск</span>
            <input
              v-model="search"
              type="text"
              autocomplete="off"
              placeholder="Имя или код"
              class="search-input"
            >
          </label>

          <div class="filter-row">
            <label class="field">
              <span class="label">Статус</span>
              <select v-model="paidFilter" class="select-input">
                <option value="all">Все</option>
                <option value="paid">Оплачено</option>
                <option value="unpaid">Не оплачено</option>
              </select>
            </label>
          </div>

          <div class="filter-row two">
            <label class="field">
              <span class="label">Дата с</span>
              <input v-model="dateFrom" type="date" class="date-input">
            </label>
            <label class="field">
              <span class="label">Дата по</span>
              <input v-model="dateTo" type="date" class="date-input">
            </label>
          </div>

          <div class="export-block">
            <span class="export-title">Экспорт за выбранный период</span>
            <div class="export-actions">
              <button class="export-btn primary" :disabled="exporting" @click="copyExport">
                Копировать
              </button>
              <button class="export-btn" :disabled="exporting" @click="downloadExport">
                Скачать TXT
              </button>
              <button class="export-btn" :disabled="exporting" @click="printExport">
                Печать
              </button>
            </div>
          </div>

          <button v-if="filtersActive" class="clear-btn" @click="clearFilters">
            Очистить фильтры
          </button>
        </section>

        <!-- Recent entries -->
        <section v-if="goods.length" class="list-section">
          <h2 class="section-title">
            {{ filtersActive ? 'Результаты' : 'Последние' }}
            <span class="count">{{ goods.length }}</span>
          </h2>
          <ul class="goods-list">
            <li v-for="item in goods" :key="item.id" class="goods-item">
              <div class="goods-info">
                <span class="goods-name">{{ item.name }}</span>
                <span class="goods-meta">
                  <span class="badge">{{ item.code }}</span>
                  {{ formatWeight(item.weight) }} · {{ formatPrice(item.price) }}
                  · {{ formatTime(item.created_at) }}
                </span>
              </div>
              <button
                class="paid-btn"
                :class="{ paid: item.has_paid }"
                :aria-label="item.has_paid ? 'Отметить как неоплаченное' : 'Отметить как оплаченное'"
                @click="togglePaid(item)"
              >
                {{ item.has_paid ? '✓ Оплачено' : 'Не оплачено' }}
              </button>
            </li>
          </ul>
        </section>

        <p v-else-if="!loadingGoods" class="empty muted">
          {{ filtersActive ? 'Ничего не найдено по заданным фильтрам.' : 'Записей пока нет. Добавьте первую выше.' }}
        </p>
      </main>

      <!-- Toast -->
      <Transition name="toast">
        <div v-if="toast" class="toast" :class="toast.type">
          {{ toast.message }}
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.app {
  min-height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.screen {
  min-height: 100dvh;
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

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 20px 8px;
}

.header h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.greeting {
  font-size: 14px;
  color: var(--tg-theme-hint-color, #888);
  margin-top: 2px;
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

.card {
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-radius: 16px;
  padding: 20px;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filters-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.field input,
.field select {
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: var(--tg-theme-bg-color, #f0f0f0);
  color: var(--tg-theme-text-color, #111);
  font-size: 18px;
  transition: border-color 0.15s;
}

.field input:focus,
.field select:focus {
  border-color: var(--tg-theme-button-color, #3390ec);
}

.search-input,
.select-input,
.date-input {
  font-size: 15px !important;
}

.code-input {
  font-size: 28px !important;
  font-weight: 700;
  letter-spacing: 8px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.weight-input {
  font-size: 28px !important;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--tg-theme-bg-color, #f0f0f0);
  opacity: 0.5;
  transition: opacity 0.2s;
}

.price-row.active {
  opacity: 1;
}

.price-label {
  font-size: 14px;
  color: var(--tg-theme-hint-color, #888);
}

.price-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--tg-theme-button-color, #3390ec);
  font-variant-numeric: tabular-nums;
}

.submit-btn {
  width: 100%;
  padding: 16px;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 700;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  opacity: 0.4;
  transition: opacity 0.2s, transform 0.1s;
}

.submit-btn.ready {
  opacity: 1;
}

.submit-btn.ready:active {
  transform: scale(0.98);
}

.submit-btn:disabled {
  cursor: not-allowed;
}

.export-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 2px;
}

.export-title {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
}

.export-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.export-btn {
  min-width: 0;
  padding: 10px 6px;
  border-radius: 10px;
  background: var(--tg-theme-bg-color, #f0f0f0);
  color: var(--tg-theme-text-color, #222);
  font-size: 12px;
  font-weight: 600;
}

.export-btn.primary {
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: wait;
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

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
  padding: 0 4px;
}

.count {
  font-weight: 400;
  color: var(--tg-theme-hint-color, #888);
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

.badge {
  display: inline-block;
  background: var(--tg-theme-bg-color, #eee);
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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

.muted {
  color: var(--tg-theme-hint-color, #888);
  font-size: 14px;
}

.empty {
  text-align: center;
  padding: 24px;
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
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
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
