<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'

interface TrashGood {
  id: number
  type: 'good'
  client_id: number
  name: string
  phone: string
  weight: number
  price: number
  has_paid: boolean
  created_at: string
  deleted_at: string
  daysLeft: number
}

interface TrashClient {
  id: number
  type: 'client'
  name: string
  phone: string
  created_at: string
  deleted_at: string
  daysLeft: number
}

interface TrashFinance {
  id: number
  type: 'finance'
  recordType: 'income' | 'expense'
  amount: number
  note: string
  created_by: string | null
  created_at: string
  deleted_at: string
  daysLeft: number
}

interface TrashResponse {
  retentionDays: number
  goods: TrashGood[]
  clients: TrashClient[]
  finance: TrashFinance[]
}

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { confirm } = useConfirm()
const { formatPrice, formatWeight, formatDateTime } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const trash = ref<TrashResponse | null>(null)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)
const busyId = ref<string | null>(null)
const segment = ref<'clients' | 'goods' | 'finance'>('clients')

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
  const ok = await confirm({
    title: 'Восстановить запись?',
    message: `«${item.name}» вернётся в активные записи.`,
    confirmLabel: 'Восстановить',
  })
  if (!ok) return
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

async function restoreClient(item: TrashClient) {
  const ok = await confirm({
    title: 'Восстановить клиента?',
    message: `«${item.name}» и связанные товары будут восстановлены.`,
    confirmLabel: 'Восстановить',
  })
  if (!ok) return
  busyId.value = `client-${item.id}`
  try {
    await apiFetch(`/api/trash/clients/${item.id}`, { method: 'POST' })
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

async function restoreFinance(item: TrashFinance) {
  const ok = await confirm({
    title: 'Восстановить запись?',
    message: `«${item.note}» вернётся в финансы.`,
    confirmLabel: 'Восстановить',
  })
  if (!ok) return
  busyId.value = `finance-${item.id}`
  try {
    await apiFetch(`/api/trash/finance/${item.id}`, { method: 'POST' })
    showToast('success', 'Финансовая запись восстановлена')
    await load()
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось восстановить')
  }
  finally {
    busyId.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Корзина"
      :subtitle="trash ? `Удаляется через ${trash.retentionDays} дн.` : undefined"
      show-refresh
      :refreshing="state === 'loading'"
      @refresh="load"
    />

    <div class="px-4 pb-3">
      <div class="ui-glass-strong grid grid-cols-3 gap-1 rounded-blob p-1.5">
        <button
          type="button"
          class="rounded-full py-2.5 text-xs font-extrabold transition"
          :class="segment === 'clients' ? 'ui-chip-active' : 'text-muted'"
          @click="segment = 'clients'"
        >
          Клиенты
          <span v-if="trash" class="opacity-80">({{ trash.clients.length }})</span>
        </button>
        <button
          type="button"
          class="rounded-full py-2.5 text-xs font-extrabold transition"
          :class="segment === 'goods' ? 'ui-chip-active' : 'text-muted'"
          @click="segment = 'goods'"
        >
          Товары
          <span v-if="trash" class="opacity-80">({{ trash.goods.length }})</span>
        </button>
        <button
          type="button"
          class="rounded-full py-2.5 text-xs font-extrabold transition"
          :class="segment === 'finance' ? 'ui-chip-active' : 'text-muted'"
          @click="segment = 'finance'"
        >
          Финансы
          <span v-if="trash" class="opacity-80">({{ trash.finance.length }})</span>
        </button>
      </div>
    </div>

    <main class="px-4 pb-6">
      <UiSpinner v-if="state === 'loading'" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

      <template v-else-if="trash">
        <ul v-if="segment === 'clients' && trash.clients.length" class="space-y-2">
          <li v-for="item in trash.clients" :key="`c-${item.id}`" class="ui-card flex items-center gap-3 px-4 py-3.5">
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] font-bold text-ink">{{ item.name }}</p>
              <p class="mt-0.5 text-xs text-muted">
                {{ formatPhone(item.phone) }} · {{ formatDateTime(item.deleted_at) }}
              </p>
              <span class="mt-1.5 inline-flex rounded-lg bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-amber-800">
                {{ item.daysLeft }} дн.
              </span>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-xl bg-brand-soft px-3 py-2 text-xs font-bold text-brand"
              :disabled="busyId === `client-${item.id}`"
              @click="restoreClient(item)"
            >
              Восстановить
            </button>
          </li>
        </ul>
        <UiEmpty v-else-if="segment === 'clients'" message="Нет удалённых клиентов" />

        <ul v-if="segment === 'goods' && trash.goods.length" class="space-y-2">
          <li v-for="item in trash.goods" :key="`g-${item.id}`" class="ui-card flex items-center gap-3 px-4 py-3.5">
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] font-bold text-ink">{{ item.name || 'Без имени' }}</p>
              <p class="mt-0.5 text-xs text-muted">
                <span v-if="item.phone" class="mr-1 font-bold tabular-nums">{{ formatPhone(item.phone) }}</span>
                {{ formatWeight(item.weight) }} · {{ formatPrice(item.price) }}
              </p>
              <p class="mt-0.5 text-[11px] text-slate-400">удалено {{ formatDateTime(item.deleted_at) }}</p>
              <span class="mt-1.5 inline-flex rounded-lg bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-amber-800">
                {{ item.daysLeft }} дн.
              </span>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-xl bg-brand-soft px-3 py-2 text-xs font-bold text-brand"
              :disabled="busyId === `good-${item.id}`"
              @click="restoreGood(item)"
            >
              Восстановить
            </button>
          </li>
        </ul>
        <UiEmpty v-else-if="segment === 'goods'" message="Нет удалённых товаров" />

        <ul v-if="segment === 'finance' && trash.finance.length" class="space-y-2">
          <li v-for="item in trash.finance" :key="`f-${item.id}`" class="ui-card flex items-center gap-3 px-4 py-3.5">
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] font-bold text-ink">{{ item.note }}</p>
              <p class="mt-0.5 text-xs text-muted">
                {{ item.recordType === 'income' ? 'Доход' : 'Расход' }}
                · {{ formatPrice(item.amount) }}
                · {{ formatDateTime(item.deleted_at) }}
              </p>
              <span class="mt-1.5 inline-flex rounded-lg bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-amber-800">
                {{ item.daysLeft }} дн.
              </span>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-xl bg-brand-soft px-3 py-2 text-xs font-bold text-brand"
              :disabled="busyId === `finance-${item.id}`"
              @click="restoreFinance(item)"
            >
              Восстановить
            </button>
          </li>
        </ul>
        <UiEmpty v-else-if="segment === 'finance'" message="Нет удалённых финансовых записей" />
      </template>
    </main>

    <UiToast :toast="toast" />
  </div>
</template>
