<script setup lang="ts">
import type { Good } from '#shared/types/domain'

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatDateTime } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const goods = ref<Good[]>([])
const loadingGoods = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)
const paidFilter = ref<'unpaid' | 'paid'>('unpaid')
const search = ref('')

let searchDebounce: ReturnType<typeof setTimeout> | undefined

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(paidFilter, () => {
  if (state.value === 'ok' || state.value === 'error') load()
})

watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (state.value === 'ok' || state.value === 'error') load()
  }, 300)
})

async function load() {
  loadingGoods.value = true
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    const params = new URLSearchParams({ paid: paidFilter.value })
    if (search.value.trim()) params.set('search', search.value.trim())
    goods.value = await apiFetch<Good[]>(`/api/goods?${params}`)
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить'
  }
  finally {
    loadingGoods.value = false
  }
}

const totals = computed(() => {
  const weight = goods.value.reduce((s, g) => s + g.weight, 0)
  const price = goods.value.reduce((s, g) => s + g.price, 0)
  return {
    count: goods.value.length,
    weight: Math.round(weight * 1000) / 1000,
    price: Math.round(price * 100) / 100,
  }
})

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

async function togglePaid(item: Good) {
  try {
    const updated = await apiFetch<Good>(`/api/goods/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: !item.has_paid }),
    })
    goods.value = goods.value.filter(g => g.id !== updated.id)
    showToast('success', updated.has_paid ? 'Отмечено оплаченным' : 'Снята оплата')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось обновить')
  }
}
</script>

<template>
  <div>
    <PageHeader title="Склад" subtitle="Товары на складе" show-refresh :refreshing="loadingGoods" @refresh="load" />

    <div class="space-y-4 px-4 pb-8">
      <div class="ui-glass flex rounded-full p-1">
        <button
          type="button"
          class="flex-1 rounded-full py-2.5 text-xs font-extrabold transition"
          :class="paidFilter === 'unpaid' ? 'bg-brand text-white shadow' : 'text-muted'"
          @click="paidFilter = 'unpaid'"
        >
          Не оплачено
        </button>
        <button
          type="button"
          class="flex-1 rounded-full py-2.5 text-xs font-extrabold transition"
          :class="paidFilter === 'paid' ? 'bg-brand text-white shadow' : 'text-muted'"
          @click="paidFilter = 'paid'"
        >
          Оплачено
        </button>
      </div>

      <label class="ui-field">
        <span class="ui-label">Поиск</span>
        <input v-model="search" type="text" class="ui-input" placeholder="Имя или телефон" autocomplete="off">
      </label>

      <div v-if="state === 'ok'" class="ui-card grid grid-cols-3 gap-2 px-3 py-3 text-center">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Шт</p>
          <p class="text-sm font-extrabold tabular-nums">{{ totals.count }}</p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Вес</p>
          <p class="text-sm font-extrabold tabular-nums">{{ formatWeight(totals.weight) }}</p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Сумма</p>
          <p class="text-sm font-extrabold tabular-nums">{{ formatPrice(totals.price) }}</p>
        </div>
      </div>

      <UiSpinner v-if="state === 'loading'" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />
      <UiEmpty
        v-else-if="!goods.length"
        :title="paidFilter === 'unpaid' ? 'Нет неоплаченных' : 'Нет оплаченных'"
        description="Товары появятся после сортировки"
      />
      <ul v-else class="space-y-2">
        <GoodsRow
          v-for="item in goods"
          :key="item.id"
          :name="item.client_name || item.name"
          :phone="item.phone"
          :meta="`${formatWeight(item.weight)} · ${formatPrice(item.price)} · ${formatDateTime(item.created_at)}`"
          :has-paid="item.has_paid"
          :initiator="item.payment_accepted_by"
          :show-trash="false"
          @toggle-paid="togglePaid(item)"
        />
      </ul>
    </div>

    <UiToast :toast="toast" />
  </div>
</template>
