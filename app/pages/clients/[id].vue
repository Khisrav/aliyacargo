<script setup lang="ts">
import type { Good } from '#shared/types/domain'
import { formatPhone } from '#shared/utils/phone'

interface ClientDetail {
  client: { id: number, name: string, phone: string, created_at: string, updated_at: string }
  goods: Good[]
  totals: {
    goodsCount: number
    totalWeight: number
    totalRevenue: number
    unpaidCount: number
    unpaidRevenue: number
    unpaidWeight: number
  }
}

const route = useRoute()
const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatDateTime } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const detail = ref<ClientDetail | null>(null)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)
const paidFilter = ref<'all' | 'paid' | 'unpaid'>('all')

const clientId = computed(() => Number(route.params.id))

const filteredGoods = computed(() => {
  const goods = detail.value?.goods ?? []
  if (paidFilter.value === 'paid') return goods.filter(g => g.has_paid)
  if (paidFilter.value === 'unpaid') return goods.filter(g => !g.has_paid)
  return goods
})

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(() => route.params.id, () => load())

async function load() {
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    detail.value = await apiFetch<ClientDetail>(`/api/clients/${clientId.value}`)
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить'
  }
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

async function togglePaid(item: Good) {
  if (!detail.value) return
  try {
    const updated = await apiFetch<Good>(`/api/goods/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: !item.has_paid }),
    })
    const idx = detail.value.goods.findIndex(g => g.id === item.id)
    if (idx !== -1) detail.value.goods[idx] = updated
    const unpaid = detail.value.goods.filter(g => !g.has_paid)
    detail.value.totals = {
      ...detail.value.totals,
      unpaidCount: unpaid.length,
      unpaidRevenue: Math.round(unpaid.reduce((s, g) => s + g.price, 0) * 100) / 100,
      unpaidWeight: Math.round(unpaid.reduce((s, g) => s + g.weight, 0) * 1000) / 1000,
    }
    haptic('light')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось обновить')
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="detail?.client.name || 'Клиент'"
      back-to="/clients"
      show-refresh
      :refreshing="state === 'loading'"
      @refresh="load"
    >
      <template v-if="detail" #subtitle>
        <p class="mt-1.5 text-sm font-semibold text-muted">
          +992 {{ formatPhone(detail.client.phone) }}
        </p>
      </template>
    </PageHeader>

    <UiSpinner v-if="state === 'loading'" />
    <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

    <main v-else-if="detail" class="space-y-4 px-4 pb-8">
      <div class="ui-card grid grid-cols-2 gap-3 px-4 py-4 text-sm">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Товаров</p>
          <p class="font-extrabold tabular-nums">{{ detail.totals.goodsCount }}</p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Вес</p>
          <p class="font-extrabold tabular-nums">{{ formatWeight(detail.totals.totalWeight) }}</p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Сумма</p>
          <p class="font-extrabold tabular-nums">{{ formatPrice(detail.totals.totalRevenue) }}</p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Долг</p>
          <p class="font-extrabold tabular-nums text-danger">{{ formatPrice(detail.totals.unpaidRevenue) }}</p>
        </div>
      </div>

      <div class="ui-glass flex rounded-full p-1">
        <button
          v-for="opt in ([{ v: 'all', l: 'Все' }, { v: 'unpaid', l: 'Долг' }, { v: 'paid', l: 'Оплачено' }] as const)"
          :key="opt.v"
          type="button"
          class="flex-1 rounded-full py-2 text-xs font-extrabold transition"
          :class="paidFilter === opt.v ? 'bg-brand text-white shadow' : 'text-muted'"
          @click="paidFilter = opt.v"
        >
          {{ opt.l }}
        </button>
      </div>

      <UiEmpty v-if="!filteredGoods.length" title="Нет товаров" />
      <ul v-else class="space-y-2">
        <GoodsRow
          v-for="item in filteredGoods"
          :key="item.id"
          :name="item.name || item.client_name"
          :meta="`${formatWeight(item.weight)} · ${formatPrice(item.price)} · ${formatDateTime(item.created_at)}`"
          :has-paid="item.has_paid"
          :initiator="item.payment_accepted_by"
          :show-trash="false"
          @toggle-paid="togglePaid(item)"
        />
      </ul>
    </main>

    <UiToast :toast="toast" />
  </div>
</template>
