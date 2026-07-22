<script setup lang="ts">
import { formatPhone, isValidPhone, normalizePhone } from '#shared/utils/phone'

definePageMeta({
  layout: 'guest',
})

interface LookupGood {
  weight: number
  price: number
  has_paid: boolean
  created_at: string
}

interface LookupResult {
  found: boolean
  phone: string
  displayPhone: string
  customer: { name: string, phone: string } | null
  goods: LookupGood[]
  stats: {
    totalCount: number
    totalWeight: number
    totalRevenue: number
    unpaidCount: number
    unpaidRevenue: number
    paidCount: number
    paidRevenue: number
  }
}

const phone = ref('')
const loading = ref(false)
const searched = ref(false)
const errorMessage = ref('')
const result = ref<LookupResult | null>(null)
const phoneRef = ref<HTMLInputElement>()

const phoneDigits = computed(() => normalizePhone(phone.value))
const canSearch = computed(() => isValidPhone(phoneDigits.value) && !loading.value)

onMounted(() => {
  nextTick(() => phoneRef.value?.focus())
})

function onPhoneInput(e: Event) {
  const input = e.target as HTMLInputElement
  const digits = normalizePhone(input.value)
  phone.value = formatPhone(digits)
  input.value = phone.value
}

async function lookup() {
  if (!canSearch.value) return

  loading.value = true
  errorMessage.value = ''
  searched.value = true

  try {
    const res = await fetch('/api/public/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneDigits.value }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.statusMessage || 'Не удалось найти данные')
    }

    result.value = data as LookupResult
  }
  catch (e) {
    result.value = null
    errorMessage.value = e instanceof Error ? e.message : 'Ошибка запроса'
  }
  finally {
    loading.value = false
  }
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'TJS', maximumFractionDigits: 0 }).format(n)
}

function formatWeight(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n) + ' кг'
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
  <div class="track-page">
    <header class="header">
      <h1>Мой груз</h1>
      <p class="subtitle">Введите номер телефона, чтобы посмотреть свои записи</p>
    </header>

    <main class="main">
      <section class="card">
        <label class="field">
          <span class="label">Телефон <span class="hint">без +992</span></span>
          <div class="phone-row">
            <span class="phone-prefix">+992</span>
            <input
              ref="phoneRef"
              :value="phone"
              type="text"
              inputmode="numeric"
              autocomplete="tel"
              placeholder="### ##-##-##"
              class="phone-input"
              @input="onPhoneInput"
              @keydown.enter.prevent="lookup"
            >
          </div>
        </label>

        <button class="submit-btn" :class="{ ready: canSearch }" :disabled="!canSearch" @click="lookup">
          {{ loading ? 'Поиск…' : 'Найти' }}
        </button>
      </section>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <template v-if="searched && result && !errorMessage">
        <section v-if="!result.found" class="card empty-card">
          <p class="muted">По номеру +992 {{ result.displayPhone }} записей не найдено.</p>
        </section>

        <template v-else>
          <section class="card identity">
            <h2>{{ result.customer?.name }}</h2>
            <p class="phone-line">+992 {{ result.displayPhone }}</p>
          </section>

          <section class="cards-grid">
            <div class="stat-card">
              <span class="stat-label">Записей</span>
              <span class="stat-value">{{ result.stats.totalCount }}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Вес</span>
              <span class="stat-value">{{ formatWeight(result.stats.totalWeight) }}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Сумма</span>
              <span class="stat-value">{{ formatPrice(result.stats.totalRevenue) }}</span>
            </div>
            <div class="stat-card danger">
              <span class="stat-label">К оплате</span>
              <span class="stat-value">{{ formatPrice(result.stats.unpaidRevenue) }}</span>
            </div>
          </section>

          <section class="history">
            <h3 class="section-title">История</h3>
            <ul v-if="result.goods.length" class="goods-list">
              <li v-for="(item, index) in result.goods" :key="`${item.created_at}-${index}`" class="goods-item">
                <div class="goods-info">
                  <span class="goods-title">
                    {{ formatWeight(item.weight) }} · {{ formatPrice(item.price) }}
                  </span>
                  <span class="goods-meta">{{ formatDateTime(item.created_at) }}</span>
                </div>
                <span class="paid-badge" :class="{ paid: item.has_paid }">
                  {{ item.has_paid ? 'Оплачено' : 'Не оплачено' }}
                </span>
              </li>
            </ul>
            <p v-else class="muted empty">Записей нет</p>
          </section>
        </template>
      </template>

      <p class="hint-bottom muted">
        Только просмотр. Изменять статус оплаты могут только сотрудники.
      </p>
    </main>
  </div>
</template>

<style scoped>
.track-page {
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.header {
  padding: 20px 20px 8px;
}

.header h1 {
  font-size: 22px;
  font-weight: 700;
}

.subtitle {
  margin-top: 6px;
  font-size: 14px;
  color: var(--tg-theme-hint-color, #888);
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
  padding: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
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

.phone-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.phone-prefix {
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-hint-color, #666);
}

.phone-input {
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: var(--tg-theme-bg-color, #f0f0f0);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
}

.phone-input:focus {
  border-color: var(--tg-theme-button-color, #3390ec);
  outline: none;
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
}

.submit-btn.ready {
  opacity: 1;
}

.submit-btn:disabled {
  cursor: not-allowed;
}

.identity h2 {
  font-size: 22px;
  font-weight: 700;
}

.phone-line {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 600;
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
  font-size: 17px;
  font-weight: 700;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 10px;
  padding: 0 4px;
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

.paid-badge {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  background: var(--tg-theme-bg-color, #f0f0f0);
  color: var(--tg-theme-hint-color, #888);
}

.paid-badge.paid {
  background: #dcfce7;
  color: #15803d;
}

.error {
  color: #dc2626;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.muted {
  color: var(--tg-theme-hint-color, #888);
  font-size: 14px;
}

.empty-card,
.empty,
.hint-bottom {
  text-align: center;
}

.hint-bottom {
  padding: 8px 4px 0;
  font-size: 12px;
}
</style>
