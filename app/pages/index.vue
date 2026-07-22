<script setup lang="ts">
import type { CustomerGood } from '~/composables/useTelegram'
import { formatPhone, isValidPhone, normalizePhone } from '#shared/utils/phone'

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()

const authState = ref<'loading' | 'ok' | 'denied' | 'error'>('loading')
const authError = ref('')
const pricePerKg = ref(1000)
const userName = ref('')

const phone = ref('')
const name = ref('')
const weight = ref('')
const nameLocked = ref(false)
const lookingUp = ref(false)

const submitting = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)
const sessionGoods = ref<CustomerGood[]>([])

const phoneRef = ref<HTMLInputElement>()
const nameRef = ref<HTMLInputElement>()
const weightRef = ref<HTMLInputElement>()

let phoneLookupToken = 0

const phoneDigits = computed(() => normalizePhone(phone.value))
const weightNum = computed(() => parseFloat(weight.value.replace(',', '.')) || 0)
const calculatedPrice = computed(() => Math.round(weightNum.value * pricePerKg.value * 100) / 100)

const canSubmit = computed(() =>
  isValidPhone(phoneDigits.value)
  && name.value.trim().length > 0
  && weightNum.value > 0
  && !submitting.value,
)

watch(ready, checkAuth, { immediate: true })

async function checkAuth() {
  if (!ready.value) return

  const allowed = await requireWorker()
  if (!allowed) return

  try {
    const res = await apiFetch<{ ok: boolean, pricePerKg: number, user: { first_name: string } }>(
      '/api/auth/check',
      { method: 'POST' },
    )
    pricePerKg.value = res.pricePerKg
    userName.value = res.user.first_name
    authState.value = 'ok'
    nextTick(() => phoneRef.value?.focus())
  }
  catch (e) {
    authState.value = 'denied'
    authError.value = e instanceof Error ? e.message : 'Доступ запрещён'
  }
}

async function lookupCustomer() {
  if (!isValidPhone(phoneDigits.value)) return

  const token = ++phoneLookupToken
  lookingUp.value = true
  try {
    const customer = await apiFetch<{ id: number, name: string, phone: string } | null>(
      `/api/customers/${phoneDigits.value}`,
    )

    if (token !== phoneLookupToken) return

    if (customer?.name) {
      name.value = customer.name
      nameLocked.value = true
      nextTick(() => weightRef.value?.focus())
    }
    else {
      nameLocked.value = false
      if (!name.value) nextTick(() => nameRef.value?.focus())
    }
  }
  catch {
    if (token === phoneLookupToken) nameLocked.value = false
  }
  finally {
    if (token === phoneLookupToken) lookingUp.value = false
  }
}

function onPhoneInput(e: Event) {
  const input = e.target as HTMLInputElement
  const digits = normalizePhone(input.value)
  phone.value = formatPhone(digits)
  input.value = phone.value
  nameLocked.value = false

  if (digits.length === 9) {
    lookupCustomer()
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
  phone.value = ''
  name.value = ''
  weight.value = ''
  nameLocked.value = false
  nextTick(() => phoneRef.value?.focus())
}

async function submit() {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    const item = await apiFetch<CustomerGood>('/api/goods', {
      method: 'POST',
      body: JSON.stringify({
        phone: phoneDigits.value,
        name: name.value.trim(),
        weight: weightNum.value,
      }),
    })
    sessionGoods.value.unshift(item)
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
    const idx = sessionGoods.value.findIndex(g => g.id === item.id)
    if (idx !== -1) sessionGoods.value[idx] = updated
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function onPhoneEnter() {
  if (isValidPhone(phoneDigits.value)) {
    lookupCustomer()
  }
}

function onNameEnter() {
  weightRef.value?.focus()
}

function onWeightEnter() {
  if (canSubmit.value) submit()
}
</script>

<template>
  <div class="app">
    <div v-if="authState === 'loading'" class="screen center">
      <div class="spinner" />
      <p class="muted">Загрузка…</p>
    </div>

    <div v-else-if="authState === 'denied'" class="screen center">
      <div class="icon-block">🔒</div>
      <h1>Доступ запрещён</h1>
      <p class="muted">{{ authError }}</p>
    </div>

    <template v-else>
      <header class="header">
        <div>
          <h1>Взвешивание</h1>
          <p v-if="userName" class="greeting">Привет, {{ userName }}</p>
        </div>
        <NuxtLink to="/goods" class="link-btn">
          Все записи
        </NuxtLink>
      </header>

      <main class="main">
        <section class="card form-card">
          <label class="field">
            <span class="label">Телефон <span class="hint">без +992</span></span>
            <div class="phone-row">
              <span class="phone-prefix">+992</span>
              <input
                ref="phoneRef"
                :value="phone"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                enterkeyhint="next"
                placeholder="### ##-##-##"
                class="phone-input"
                @input="onPhoneInput"
                @keydown.enter.prevent="onPhoneEnter"
                @blur="lookupCustomer"
              >
            </div>
            <span v-if="lookingUp" class="field-hint">Ищем клиента…</span>
            <span v-else-if="nameLocked" class="field-hint ok">Клиент найден — имя подставлено</span>
          </label>

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

        <section v-if="sessionGoods.length" class="list-section">
          <h2 class="section-title">
            В этой сессии
            <span class="count">{{ sessionGoods.length }}</span>
          </h2>
          <ul class="goods-list">
            <li v-for="item in sessionGoods" :key="item.id" class="goods-item">
              <div class="goods-info">
                <span class="goods-name">{{ item.name }}</span>
                <span class="goods-meta">
                  <span class="badge">{{ formatPhone(item.phone) }}</span>
                  {{ formatWeight(item.weight) }} · {{ formatPrice(item.price) }}
                  · {{ formatDateTime(item.created_at) }}
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
        </section>

        <p v-else class="empty muted">
          Записей в этой сессии пока нет. Добавьте первую выше.
        </p>
      </main>

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
  gap: 12px;
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

.link-btn {
  flex-shrink: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--tg-theme-secondary-bg-color, #eee);
  color: var(--tg-theme-button-color, #3390ec);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
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

.field-hint {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
}

.field-hint.ok {
  color: #15803d;
}

.field input {
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: var(--tg-theme-bg-color, #f0f0f0);
  color: var(--tg-theme-text-color, #111);
  font-size: 18px;
  transition: border-color 0.15s;
}

.field input:focus {
  border-color: var(--tg-theme-button-color, #3390ec);
}

.phone-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.phone-prefix {
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-hint-color, #666);
}

.phone-input {
  font-size: 22px !important;
  font-weight: 700;
  letter-spacing: 1px;
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
