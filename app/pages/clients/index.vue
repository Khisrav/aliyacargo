<script setup lang="ts">
import { formatPhone, normalizePhone } from '#shared/utils/phone'

interface CustomerListItem {
  id: number
  phone: string
  name: string
  created_at: string
  goodsCount: number
  totalWeight: number
  totalRevenue: number
  unpaidCount: number
  unpaidRevenue: number
  lastActivityAt: string | null
}

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { confirm } = useConfirm()
const { formatPrice, formatWeight, formatNumber, formatDate } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const customers = ref<CustomerListItem[]>([])

const filtersOpen = ref(false)
const search = ref('')
const debtFilter = ref<'all' | 'with_debt' | 'no_debt' | 'no_goods'>('all')
const activityFrom = ref('')
const activityTo = ref('')
const minGoods = ref('')
const sort = ref<'name' | 'debt' | 'revenue' | 'goods' | 'recent'>('name')
const exporting = ref(false)

const filtersActive = computed(() =>
  search.value.trim().length > 0
  || debtFilter.value !== 'all'
  || !!activityFrom.value
  || !!activityTo.value
  || !!minGoods.value
  || sort.value !== 'name',
)

let searchDebounce: ReturnType<typeof setTimeout> | undefined
const gated = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  gated.value = true
  await load()
}, { immediate: true })
watch([debtFilter, activityFrom, activityTo, minGoods, sort], () => {
  if (gated.value) load()
})
watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (gated.value) load()
  }, 300)
})

function buildQuery() {
  const params = new URLSearchParams()
  if (search.value.trim()) params.set('search', search.value.trim())
  if (debtFilter.value !== 'all') params.set('debt', debtFilter.value)
  if (activityFrom.value) params.set('activityFrom', activityFrom.value)
  if (activityTo.value) params.set('activityTo', activityTo.value)
  if (minGoods.value) params.set('minGoods', minGoods.value)
  if (sort.value !== 'name') params.set('sort', sort.value)
  const qs = params.toString()
  return qs ? `/api/customers?${qs}` : '/api/customers'
}

async function load() {
  if (!ready.value) return

  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    customers.value = await apiFetch<CustomerListItem[]>(buildQuery())
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить клиентов'
  }
}

function clearFilters() {
  search.value = ''
  debtFilter.value = 'all'
  activityFrom.value = ''
  activityTo.value = ''
  minGoods.value = ''
  sort.value = 'name'
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

function phoneTail(phone: string) {
  return normalizePhone(phone).slice(-4)
}

function formatExportRows(rows: CustomerListItem[]) {
  return rows
    .map((item, index) => {
      const weight = formatNumber(item.totalWeight, 1)
      const revenue = formatNumber(item.totalRevenue, 0)
      return `${index + 1}. ${item.name} — ${phoneTail(item.phone)} — ${weight} кг — ${revenue} с.`
    })
    .join('\n')
}

async function copyToClipboard(text: string) {
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
}

async function copyExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    if (activityFrom.value && activityTo.value && activityFrom.value > activityTo.value) {
      throw new Error('Дата «с» не может быть позже даты «по»')
    }

    const rows = customers.value.length
      ? customers.value
      : await apiFetch<CustomerListItem[]>(buildQuery())

    if (!rows.length) throw new Error('По выбранным фильтрам клиентов нет')

    await copyToClipboard(formatExportRows(rows))
    showToast('success', `Скопировано: ${rows.length}`)
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось скопировать')
  }
  finally {
    exporting.value = false
  }
}

async function removeCustomer(customer: CustomerListItem, event: Event) {
  event.preventDefault()
  event.stopPropagation()
  const ok = await confirm({
    title: 'Удалить клиента?',
    message: `«${customer.name}» и все его записи будут перемещены в корзину.`,
    confirmLabel: 'В корзину',
    danger: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/trash/customers/${customer.id}`, { method: 'DELETE' })
    customers.value = customers.value.filter(c => c.id !== customer.id)
    showToast('success', 'Клиент перемещён в корзину')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось удалить')
  }
}
</script>

<template>
  <div>
    <PageHeader title="Клиенты" show-refresh @refresh="load" />

    <div class="space-y-3 pb-6">
      <FiltersSheet
        v-model="filtersOpen"
        title="Фильтры"
        :active="filtersActive"
        @clear="clearFilters"
      >
        <label class="ui-field">
          <span class="ui-label">Поиск</span>
          <input v-model="search" type="text" autocomplete="off" placeholder="Имя или телефон" class="ui-input">
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="ui-field">
            <span class="ui-label">Долг</span>
            <select v-model="debtFilter" class="ui-input">
              <option value="all">Все</option>
              <option value="with_debt">С долгом</option>
              <option value="no_debt">Без долга</option>
              <option value="no_goods">Без записей</option>
            </select>
          </label>
          <label class="ui-field">
            <span class="ui-label">Сортировка</span>
            <select v-model="sort" class="ui-input">
              <option value="name">По имени</option>
              <option value="debt">По долгу</option>
              <option value="revenue">По сумме</option>
              <option value="goods">По кол-ву</option>
              <option value="recent">По активности</option>
            </select>
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="ui-field">
            <span class="ui-label">Период с</span>
            <input v-model="activityFrom" type="date" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">Период по</span>
            <input v-model="activityTo" type="date" class="ui-input">
          </label>
        </div>

        <label class="ui-field">
          <span class="ui-label">Мин. записей</span>
          <input v-model="minGoods" type="number" min="0" inputmode="numeric" placeholder="0" class="ui-input">
        </label>

        <div class="rounded-[1.35rem] border border-white/60 bg-white/40 p-3">
          <p class="mb-2 text-xs font-medium text-muted">
            Копирует текущую выборку: один клиент — одна строка (вес и сумма сгруппированы).
          </p>
          <button type="button" class="ui-btn-primary w-full py-3 text-sm" :disabled="exporting || state !== 'ok'" @click="copyExport">
            {{ exporting ? 'Копирование…' : 'Копировать список' }}
          </button>
        </div>

        <button
          v-if="filtersActive"
          type="button"
          class="ui-btn-ghost w-full text-brand"
          @click="clearFilters"
        >
          Очистить фильтры
        </button>
      </FiltersSheet>

      <div class="px-4">
        <div v-if="state === 'ok'" class="mb-3 flex items-center justify-between gap-3 px-1">
          <p class="text-xs font-medium text-muted">
            Найдено: {{ customers.length }}
          </p>
          <button
            type="button"
            class="ui-chip text-brand"
            :disabled="exporting || !customers.length"
            @click="copyExport"
          >
            {{ exporting ? '…' : 'Копировать' }}
          </button>
        </div>

        <UiSpinner v-if="state === 'loading'" />
        <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

        <template v-else>
          <ul v-if="customers.length" class="space-y-2">
            <li v-for="customer in customers" :key="customer.id" class="relative">
              <NuxtLink
                :to="`/clients/${customer.id}`"
                class="ui-card block px-4 py-4 pr-14 transition active:scale-[0.99]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-[15px] font-extrabold text-ink">{{ customer.name }}</p>
                    <p class="mt-0.5 text-xs font-bold tabular-nums text-muted">{{ formatPhone(customer.phone) }}</p>
                  </div>
                  <span class="text-lg text-slate-300">›</span>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
                  <span>{{ customer.goodsCount }} зап. · {{ formatWeight(customer.totalWeight) }}</span>
                  <span class="font-bold text-ink">{{ formatPrice(customer.totalRevenue) }}</span>
                </div>
                <p class="mt-1 text-[11px] text-slate-400">
                  Активность: {{ formatDate(customer.lastActivityAt) }}
                </p>
                <div
                  v-if="customer.unpaidCount"
                  class="mt-2 inline-flex rounded-xl bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger"
                >
                  Долг {{ formatPrice(customer.unpaidRevenue) }}
                </div>
              </NuxtLink>
              <button
                type="button"
                class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-danger-soft text-danger"
                aria-label="Удалить"
                @click="removeCustomer(customer, $event)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            </li>
          </ul>

          <UiEmpty
            v-else
            :message="filtersActive ? 'Ничего не найдено по заданным фильтрам.' : 'Клиентов пока нет.'"
          />
        </template>
      </div>
    </div>

    <UiToast :toast="toast" />
  </div>
</template>
