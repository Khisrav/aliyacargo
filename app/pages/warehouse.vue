<script setup lang="ts">
import type { Good } from '#shared/types/domain'
import { formatPhone } from '#shared/utils/phone'
import { normalizeTrackCode, tracksEnabled } from '#shared/utils/tracks'

const route = useRoute()
const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatDateTime, formatDate } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const goods = ref<Good[]>([])
const loadingGoods = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)
const paidFilter = ref<'unpaid' | 'paid'>('unpaid')
const filtersOpen = ref(false)
const paidFrom = ref('')
const paidTo = ref('')
const search = ref('')
const trackQuery = ref('')
const trackSearching = ref(false)
const trackHit = ref<Good | null>(null)
const trackFoundCode = ref('')
const trackMiss = ref('')

let searchDebounce: ReturnType<typeof setTimeout> | undefined

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

const paidRangeActive = computed(() => !!paidFrom.value || !!paidTo.value)

const paidRangeLabel = computed(() => {
  if (!paidRangeActive.value) return ''
  const from = paidFrom.value ? formatDate(paidFrom.value) : '…'
  const to = paidTo.value ? formatDate(paidTo.value) : '…'
  return `${from} — ${to}`
})

watch([paidFilter, paidFrom, paidTo], () => {
  if (paidRangeActive.value && paidFilter.value !== 'paid') {
    paidFilter.value = 'paid'
    return
  }
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
    if (paidFrom.value && paidTo.value && paidFrom.value > paidTo.value) {
      state.value = 'error'
      errorMessage.value = 'Дата «с» позже даты «по»'
      return
    }
    const params = new URLSearchParams({ paid: paidFilter.value })
    if (search.value.trim()) params.set('search', search.value.trim())
    if (paidFilter.value === 'paid' && paidFrom.value) params.set('paidFrom', paidFrom.value)
    if (paidFilter.value === 'paid' && paidTo.value) params.set('paidTo', paidTo.value)
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

function setPaidFilter(next: 'unpaid' | 'paid') {
  if (next === 'unpaid') {
    paidFrom.value = ''
    paidTo.value = ''
  }
  paidFilter.value = next
}

function clearPaidRange() {
  paidFrom.value = ''
  paidTo.value = ''
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

function openGood(item: Good) {
  navigateTo({ path: `/goods/${item.id}`, query: { from: route.fullPath } })
}

async function searchTrack() {
  const code = normalizeTrackCode(trackQuery.value)
  if (!code || trackSearching.value) return
  trackSearching.value = true
  trackHit.value = null
  trackFoundCode.value = ''
  trackMiss.value = ''
  try {
    const data = await apiFetch<{ found: boolean, code: string, good?: Good }>(
      `/api/goods/track?code=${encodeURIComponent(code)}`,
    )
    if (!data.found || !data.good) trackMiss.value = data.code
    else {
      trackHit.value = data.good
      trackFoundCode.value = data.code
    }
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось найти')
  }
  finally {
    trackSearching.value = false
  }
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
    goods.value = goods.value.filter(g => g.id !== updated.id)
    showToast('success', 'Отмечено оплаченным')
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
    goods.value = goods.value.filter(g => g.id !== updated.id)
    showToast('success', 'Снята оплата')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось обновить')
  }
}

</script>

<template>
  <div>
    <PageHeader title="Склад" subtitle="Товары на складе" show-refresh :refreshing="loadingGoods" @refresh="load">
      <template #actions>
        <button
          type="button"
          class="ui-icon-btn"
          :class="paidRangeActive ? 'border-brand/25 bg-gradient-to-br from-teal-400 to-brand text-white shadow-[0_8px_20px_rgba(13,148,136,0.3)]' : ''"
          aria-label="Фильтр по дате оплаты"
          @click="filtersOpen = true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
          </svg>
        </button>
      </template>
    </PageHeader>

    <div class="space-y-4 px-4 pb-8">
      <div class="ui-glass flex rounded-full p-1">
        <button
          type="button"
          class="flex-1 rounded-full py-2.5 text-xs font-extrabold transition"
          :class="paidFilter === 'unpaid' ? 'bg-brand text-white shadow' : 'text-muted'"
          @click="setPaidFilter('unpaid')"
        >
          Долг
        </button>
        <button
          type="button"
          class="flex-1 rounded-full py-2.5 text-xs font-extrabold transition"
          :class="paidFilter === 'paid' ? 'bg-brand text-white shadow' : 'text-muted'"
          @click="setPaidFilter('paid')"
        >
          Оплачено
        </button>
      </div>

      <label v-if="tracksEnabled" class="ui-field">
        <span class="ui-label">Трек-номер</span>
        <input
          v-model="trackQuery"
          type="text"
          class="ui-input font-mono tracking-wide"
          placeholder="Код с наклейки"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="search"
          maxlength="120"
          @keydown.enter.prevent="searchTrack"
        >
        <button
          type="button"
          class="ui-btn-primary w-full"
          :disabled="!normalizeTrackCode(trackQuery) || trackSearching"
          @click="searchTrack"
        >
          {{ trackSearching ? 'Поиск…' : 'Найти' }}
        </button>
      </label>

      <p v-if="tracksEnabled && trackMiss" class="ui-card px-5 py-6 text-center text-sm font-medium text-muted">
        Трек {{ trackMiss }} не найден.
      </p>

      <button
        v-else-if="tracksEnabled && trackHit"
        type="button"
        class="ui-card w-full overflow-hidden text-left"
        @click="openGood(trackHit)"
      >
        <div
          class="flex items-center gap-3 px-5 py-4"
          :class="trackHit.has_paid ? 'bg-emerald-50/80' : 'bg-white/35'"
        >
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            :class="trackHit.has_paid
              ? 'bg-gradient-to-br from-emerald-300 to-success text-white'
              : 'border border-white/80 bg-white/70 text-muted'"
          >
            <svg v-if="trackHit.has_paid" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[15px] font-extrabold text-ink">{{ trackHit.client_name || trackHit.name }}</p>
            <p class="mt-0.5 text-sm font-semibold" :class="trackHit.has_paid ? 'text-emerald-800' : 'text-muted'">
              {{ trackHit.has_paid ? 'Оплачено' : 'Не оплачено' }}
            </p>
            <p class="mt-0.5 break-all font-mono text-xs text-muted">{{ trackFoundCode }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 px-5 py-4">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">Вес</p>
            <p class="mt-1 text-xl font-normal tabular-nums text-teal-700/80">{{ formatWeight(trackHit.weight) }}</p>
          </div>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">Сумма</p>
            <p class="mt-1 text-xl font-normal tabular-nums text-amber-700/80">{{ formatPrice(trackHit.price) }}</p>
          </div>
        </div>
        <div class="space-y-2 border-t border-white/70 px-5 py-4 text-sm">
          <p v-if="trackHit.phone" class="font-medium tabular-nums text-slate-500">
            +992 {{ formatPhone(trackHit.phone) }}
          </p>
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-muted">Создан</span>
            <span class="font-normal tabular-nums text-sky-700/80">{{ formatDateTime(trackHit.created_at) }}</span>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-muted">Оплачен</span>
            <span class="font-normal tabular-nums" :class="trackHit.paid_at ? 'text-sky-700/80' : 'text-slate-400'">
              {{ trackHit.paid_at ? formatDateTime(trackHit.paid_at) : '—' }}
            </span>
          </div>
          <p v-if="trackHit.payment_accepted_by" class="text-slate-400">
            {{ trackHit.payment_accepted_by }}
          </p>
          <p class="pt-1 text-sm font-semibold text-brand">Открыть</p>
        </div>
      </button>

      <p v-if="paidRangeActive" class="px-1 text-xs font-bold text-brand">
        Оплачено {{ paidRangeLabel }}
      </p>

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
        :title="paidRangeActive ? 'Нет оплат за этот период' : paidFilter === 'unpaid' ? 'Нет неоплаченных' : 'Нет оплаченных'"
        description="Товары появятся после сортировки"
      />
      <ul v-else class="space-y-2">
        <GoodsRow
          v-for="item in goods"
          :key="item.id"
          :name="item.client_name || item.name"
          :phone="item.phone"
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
    </div>

    <UiSheet v-model="filtersOpen">
      <div class="space-y-4 pt-1">
        <h2 class="text-xl font-extrabold text-ink">Дата оплаты</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="ui-field">
            <span class="ui-label">С</span>
            <input v-model="paidFrom" type="date" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">По</span>
            <input v-model="paidTo" type="date" class="ui-input">
          </label>
        </div>
        <p class="text-xs font-medium text-muted">
          Товары, оплаченные в эти дни. Пустая граница не ограничивает период.
        </p>
        <button
          v-if="paidRangeActive"
          type="button"
          class="ui-btn-ghost w-full"
          @click="clearPaidRange"
        >
          Сбросить
        </button>
      </div>
    </UiSheet>

    <UiToast :toast="toast" />
  </div>
</template>
