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
const { confirm } = useConfirm()
const { formatPrice, formatWeight, formatNumber, formatDateTime, formatDate } = useFormatters()

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

const statItems = computed(() => {
  if (!profile.value) return []
  const s = profile.value.stats
  return [
    { label: 'Записей', value: s.totalCount },
    { label: 'Вес', value: formatWeight(s.totalWeight) },
    { label: 'Сумма', value: formatPrice(s.totalRevenue), tone: 'accent' as const },
    { label: 'Долг', value: formatPrice(s.unpaidRevenue), tone: 'danger' as const },
  ]
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

function recomputeStats() {
  if (!profile.value) return
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
    firstAt: goods.length ? goods[goods.length - 1]!.created_at : null,
    lastAt: goods.length ? goods[0]!.created_at : null,
  }
}

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
    recomputeStats()
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

async function removeGood(item: CustomerGood) {
  const ok = await confirm({
    title: 'Удалить запись?',
    message: `${formatWeight(item.weight)} будет перемещена в корзину.`,
    confirmLabel: 'В корзину',
    danger: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/trash/goods/${item.id}`, { method: 'DELETE' })
    if (!profile.value) return
    profile.value.goods = profile.value.goods.filter(g => g.id !== item.id)
    recomputeStats()
    showToast('success', 'Перемещено в корзину')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось удалить')
  }
}

async function removeCustomer() {
  if (!profile.value) return
  const name = profile.value.customer.name
  const ok = await confirm({
    title: 'Удалить клиента?',
    message: `«${name}» и все его записи будут перемещены в корзину.`,
    confirmLabel: 'В корзину',
    danger: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/trash/customers/${profile.value.customer.id}`, { method: 'DELETE' })
    showToast('success', 'Клиент перемещён в корзину')
    await navigateTo('/clients')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось удалить')
  }
}
</script>

<template>
  <div>
    <PageHeader title="Клиент" back-to="/clients" show-refresh @refresh="load" />

    <UiSpinner v-if="state === 'loading'" />
    <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

    <main v-else-if="profile" class="space-y-4 px-4 pb-6">
      <section class="ui-card px-5 py-5">
        <h2 class="text-xl font-extrabold text-ink">{{ profile.customer.name }}</h2>
        <p class="mt-1 text-sm font-bold tabular-nums text-brand">+992 {{ formatPhone(profile.customer.phone) }}</p>
        <p class="mt-1 text-xs text-muted">Клиент с {{ formatDate(profile.customer.created_at) }}</p>
        <button type="button" class="mt-4 w-full rounded-2xl bg-danger-soft py-3 text-sm font-bold text-danger" @click="removeCustomer">
          Удалить клиента
        </button>
      </section>

      <UiStatGrid :items="statItems" />

      <section class="ui-card space-y-3 px-4 py-4">
        <h3 class="text-sm font-bold text-ink">Статистика</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-muted">Оплачено</span>
            <span class="font-bold">{{ profile.stats.paidCount }} · {{ formatPrice(profile.stats.paidRevenue) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">Не оплачено</span>
            <span class="font-bold">{{ profile.stats.unpaidCount }} · {{ formatPrice(profile.stats.unpaidRevenue) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">Оплата</span>
            <span class="font-bold">{{ formatNumber(profile.stats.paidRate, 0) }}%</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">Средний вес</span>
            <span class="font-bold">{{ formatWeight(profile.stats.avgWeight) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">Средняя цена</span>
            <span class="font-bold">{{ formatPrice(profile.stats.avgPrice) }}</span>
          </div>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-surface">
          <div
            class="h-full rounded-full bg-brand transition-all"
            :style="{ width: `${profile.stats.totalCount ? profile.stats.paidRate : 0}%` }"
          />
        </div>
      </section>

      <section class="space-y-2.5">
        <div class="flex items-center justify-between gap-3 px-1">
          <h3 class="text-sm font-bold text-ink">История грузов</h3>
          <select v-model="paidFilter" class="ui-chip text-ink">
            <option value="all">Все</option>
            <option value="paid">Оплачено</option>
            <option value="unpaid">Не оплачено</option>
          </select>
        </div>

        <ul v-if="filteredGoods.length" class="space-y-2">
          <GoodsRow
            v-for="item in filteredGoods"
            :key="item.id"
            :title="`${formatWeight(item.weight)} · ${formatPrice(item.price)}`"
            :meta="formatDateTime(item.created_at)"
            :initiator="item.initiator"
            :has-paid="item.has_paid"
            @toggle-paid="togglePaid(item)"
            @remove="removeGood(item)"
          />
        </ul>
        <UiEmpty v-else message="Записей нет" />
      </section>
    </main>

    <UiToast :toast="toast" />
  </div>
</template>
