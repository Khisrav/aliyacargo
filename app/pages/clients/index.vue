<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'

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

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { confirm } = useConfirm()
const { formatPrice, formatWeight, formatDate } = useFormatters()

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

async function load() {
  if (!ready.value) return

  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    const params = new URLSearchParams()
    if (search.value.trim()) params.set('search', search.value.trim())
    if (debtFilter.value !== 'all') params.set('debt', debtFilter.value)
    if (activityFrom.value) params.set('activityFrom', activityFrom.value)
    if (activityTo.value) params.set('activityTo', activityTo.value)
    if (minGoods.value) params.set('minGoods', minGoods.value)
    if (sort.value !== 'name') params.set('sort', sort.value)

    const qs = params.toString()
    customers.value = await apiFetch<CustomerListItem[]>(qs ? `/api/customers?${qs}` : '/api/customers')
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
  setTimeout(() => { toast.value = null }, 2500)
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
            <span class="ui-label">Активность с</span>
            <input v-model="activityFrom" type="date" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">Активность по</span>
            <input v-model="activityTo" type="date" class="ui-input">
          </label>
        </div>

        <label class="ui-field">
          <span class="ui-label">Мин. записей</span>
          <input v-model="minGoods" type="number" min="0" inputmode="numeric" placeholder="0" class="ui-input">
        </label>

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
        <UiSpinner v-if="state === 'loading'" />
        <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

        <template v-else>
          <p class="mb-3 px-1 text-xs font-medium text-muted">
            Найдено: {{ customers.length }}
          </p>

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
