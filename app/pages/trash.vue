<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'

interface TrashGood {
  id: number
  type: 'good'
  customer_id: number
  name: string
  phone: string
  weight: number
  price: number
  has_paid: boolean
  created_at: string
  deleted_at: string
  daysLeft: number
}

interface TrashCustomer {
  id: number
  type: 'customer'
  name: string
  phone: string
  created_at: string
  deleted_at: string
  daysLeft: number
}

interface TrashResponse {
  retentionDays: number
  goods: TrashGood[]
  customers: TrashCustomer[]
}

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const trash = ref<TrashResponse | null>(null)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)
const busyId = ref<string | null>(null)

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

async function load() {
  state.value = 'loading'
  try {
    trash.value = await apiFetch<TrashResponse>('/api/trash')
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить корзину'
  }
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

async function restoreGood(item: TrashGood) {
  if (!confirm(`Восстановить запись «${item.name}»?`)) return
  busyId.value = `good-${item.id}`
  try {
    await apiFetch(`/api/trash/goods/${item.id}`, { method: 'POST' })
    showToast('success', 'Запись восстановлена')
    await load()
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось восстановить')
  }
  finally {
    busyId.value = null
  }
}

async function restoreCustomer(item: TrashCustomer) {
  if (!confirm(`Восстановить клиента «${item.name}» и связанные записи?`)) return
  busyId.value = `customer-${item.id}`
  try {
    await apiFetch(`/api/trash/customers/${item.id}`, { method: 'POST' })
    showToast('success', 'Клиент восстановлен')
    await load()
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось восстановить')
  }
  finally {
    busyId.value = null
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
</script>

<template>
  <div class="trash-page">
    <header class="header">
      <div>
        <h1>Корзина</h1>
        <p v-if="trash" class="subtitle">
          Удаляется безвозвратно через {{ trash.retentionDays }} дн.
        </p>
      </div>
      <button class="refresh-btn" aria-label="Обновить" @click="load">
        ↻
      </button>
    </header>

    <main class="main">
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

      <template v-else-if="trash">
        <section>
          <h2 class="section-title">
            Клиенты
            <span class="count">{{ trash.customers.length }}</span>
          </h2>
          <ul v-if="trash.customers.length" class="list">
            <li v-for="item in trash.customers" :key="`c-${item.id}`" class="item">
              <div class="info">
                <span class="name">{{ item.name }}</span>
                <span class="meta">
                  {{ formatPhone(item.phone) }} · удалено {{ formatDateTime(item.deleted_at) }}
                </span>
                <span class="days">Осталось {{ item.daysLeft }} дн.</span>
              </div>
              <button
                class="restore-btn"
                :disabled="busyId === `customer-${item.id}`"
                @click="restoreCustomer(item)"
              >
                Восстановить
              </button>
            </li>
          </ul>
          <p v-else class="empty muted">Нет удалённых клиентов</p>
        </section>

        <section>
          <h2 class="section-title">
            Записи
            <span class="count">{{ trash.goods.length }}</span>
          </h2>
          <ul v-if="trash.goods.length" class="list">
            <li v-for="item in trash.goods" :key="`g-${item.id}`" class="item">
              <div class="info">
                <span class="name">{{ item.name || 'Без имени' }}</span>
                <span class="meta">
                  <span v-if="item.phone" class="badge">{{ formatPhone(item.phone) }}</span>
                  {{ formatWeight(item.weight) }} · {{ formatPrice(item.price) }}
                </span>
                <span class="meta">удалено {{ formatDateTime(item.deleted_at) }}</span>
                <span class="days">Осталось {{ item.daysLeft }} дн.</span>
              </div>
              <button
                class="restore-btn"
                :disabled="busyId === `good-${item.id}`"
                @click="restoreGood(item)"
              >
                Восстановить
              </button>
            </li>
          </ul>
          <p v-else class="empty muted">Нет удалённых записей</p>
        </section>
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
.trash-page {
  min-height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 16px);
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
}

.subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--tg-theme-hint-color, #888);
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
  gap: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 10px;
  padding: 0 4px;
}

.count {
  font-weight: 400;
  color: var(--tg-theme-hint-color, #888);
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--tg-theme-secondary-bg-color, #fff);
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.name {
  font-weight: 700;
  font-size: 15px;
}

.meta {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
}

.days {
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
}

.badge {
  display: inline-block;
  background: var(--tg-theme-bg-color, #eee);
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 700;
  margin-right: 4px;
}

.restore-btn {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
}

.restore-btn:disabled {
  opacity: 0.5;
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
  padding: 12px;
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
