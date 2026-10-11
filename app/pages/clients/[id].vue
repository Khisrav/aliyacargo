<script setup lang="ts">
import type { Client, Good } from '#shared/types/domain'
import { formatPhone, isValidPhone, normalizePhone } from '#shared/utils/phone'
import { tracksEnabled } from '#shared/utils/tracks'

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
const editOpen = ref(false)
const editName = ref('')
const editPhone = ref('')
const editSaving = ref(false)

const clientId = computed(() => Number(route.params.id))

const canSaveEdit = computed(() =>
  editName.value.trim().length > 0 && isValidPhone(editPhone.value) && !editSaving.value,
)

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

function applyGood(updated: Good) {
  if (!detail.value) return
  const idx = detail.value.goods.findIndex(g => g.id === updated.id)
  if (idx !== -1) detail.value.goods[idx] = updated
  const unpaid = detail.value.goods.filter(g => !g.has_paid)
  detail.value.totals = {
    ...detail.value.totals,
    unpaidCount: unpaid.length,
    unpaidRevenue: Math.round(unpaid.reduce((s, g) => s + g.price, 0) * 100) / 100,
    unpaidWeight: Math.round(unpaid.reduce((s, g) => s + g.weight, 0) * 1000) / 1000,
  }
}

function openGood(item: Good) {
  navigateTo({ path: `/goods/${item.id}`, query: { from: route.fullPath } })
}

async function requestPay(item: Good) {
  if (item.has_paid) {
    void clearPaid(item)
    return
  }
  if (tracksEnabled) {
    openGood(item)
    return
  }
  try {
    const updated = await apiFetch<Good>(`/api/goods/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: true }),
    })
    applyGood(updated)
    haptic('light')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось обновить')
  }
}

async function clearPaid(item: Good) {
  try {
    const updated = await apiFetch<Good>(`/api/goods/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: false }),
    })
    applyGood(updated)
    haptic('light')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось обновить')
  }
}

function openEdit() {
  if (!detail.value) return
  editName.value = detail.value.client.name
  editPhone.value = formatPhone(detail.value.client.phone)
  editOpen.value = true
}

function onPhoneInput(e: Event) {
  editPhone.value = formatPhone(normalizePhone((e.target as HTMLInputElement).value))
}

async function saveEdit() {
  if (!canSaveEdit.value || !detail.value) return
  editSaving.value = true
  const previousName = detail.value.client.name
  try {
    const updated = await apiFetch<Client>(`/api/clients/${clientId.value}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editName.value.trim(),
        phone: normalizePhone(editPhone.value),
      }),
    })
    detail.value.client = { ...detail.value.client, ...updated }
    detail.value.goods = detail.value.goods.map(item => ({
      ...item,
      client_name: updated.name,
      phone: updated.phone,
      name: item.name === previousName ? updated.name : item.name,
    }))
    editOpen.value = false
    showToast('success', 'Клиент обновлён')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось сохранить')
  }
  finally {
    editSaving.value = false
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
      <template v-if="detail" #actions>
        <button type="button" class="ui-icon-btn" aria-label="Изменить" @click="openEdit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
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
          :name="item.name && item.name !== detail.client.name ? item.name : undefined"
          :weight="formatWeight(item.weight)"
          :price="formatPrice(item.price)"
          :when="formatDateTime(item.created_at)"
          :has-paid="item.has_paid"
          :initiator="item.payment_accepted_by"
          :paid-at="item.paid_at ? formatDateTime(item.paid_at) : ''"
          :track-count="tracksEnabled ? item.tracks.length : 0"
          :show-trash="false"
          @toggle-paid="requestPay(item)"
          @view-tracks="openGood(item)"
        />
      </ul>
    </main>

    <UiSheet v-model="editOpen">
      <div class="space-y-4 pt-1">
        <h2 class="text-xl font-extrabold text-ink">Изменить клиента</h2>
        <label class="ui-field">
          <span class="ui-label">Имя</span>
          <input v-model="editName" type="text" class="ui-input" autocomplete="off">
        </label>
        <UiPhoneField
          :model-value="editPhone"
          label="Телефон"
          hint="без +992"
          @input="onPhoneInput"
          @enter="saveEdit"
        />
        <button type="button" class="ui-btn-primary w-full" :disabled="!canSaveEdit" @click="saveEdit">
          {{ editSaving ? 'Сохранение…' : 'Сохранить' }}
        </button>
      </div>
    </UiSheet>

    <UiToast :toast="toast" />
  </div>
</template>
