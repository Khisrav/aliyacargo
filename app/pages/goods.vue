<script setup lang="ts">
import type { CustomerGood } from '~/composables/useTelegram'
import { normalizePhone } from '#shared/utils/phone'

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { confirm } = useConfirm()
const { formatPrice, formatWeight, formatDateTime } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const goods = ref<CustomerGood[]>([])
const loadingGoods = ref(false)
const exporting = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)

const filtersOpen = ref(false)
const search = ref('')
const paidFilter = ref<'all' | 'paid' | 'unpaid'>('all')
const dateFrom = ref('')
const dateTo = ref('')
const filtersActive = computed(() =>
  search.value.trim().length > 0 || paidFilter.value !== 'all' || !!dateFrom.value || !!dateTo.value,
)

let searchDebounce: ReturnType<typeof setTimeout> | undefined

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })
watch([paidFilter, dateFrom, dateTo], () => {
  if (state.value === 'ok') load()
})
watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (state.value === 'ok' || state.value === 'error') load()
  }, 300)
})

function buildQuery() {
  const params = new URLSearchParams()
  if (search.value.trim()) params.set('search', search.value.trim())
  if (paidFilter.value !== 'all') params.set('paid', paidFilter.value)
  if (dateFrom.value) params.set('dateFrom', dateFrom.value)
  if (dateTo.value) params.set('dateTo', dateTo.value)
  const qs = params.toString()
  return qs ? `/api/goods?${qs}` : '/api/goods'
}

async function load() {
  if (!ready.value) return

  loadingGoods.value = true
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    goods.value = await apiFetch<CustomerGood[]>(buildQuery())
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить записи'
  }
  finally {
    loadingGoods.value = false
  }
}

function clearFilters() {
  search.value = ''
  paidFilter.value = 'all'
  dateFrom.value = ''
  dateTo.value = ''
}

function buildExportQuery() {
  const params = new URLSearchParams()
  if (dateFrom.value) params.set('dateFrom', dateFrom.value)
  if (dateTo.value) params.set('dateTo', dateTo.value)
  const qs = params.toString()
  return qs ? `/api/goods/export?${qs}` : '/api/goods/export'
}

function phoneTail(phone: string) {
  return normalizePhone(phone).slice(-4)
}

function formatExportRows(rows: CustomerGood[]) {
  return rows
    .map((item, index) => {
      return `${index + 1}. ${item.name} — ${phoneTail(item.phone)} — ${item.weight} кг — ${item.price} с.`
    })
    .join('\n')
}

async function copyExport() {
  exporting.value = true
  try {
    if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
      throw new Error('Дата начала не может быть позже даты окончания')
    }

    const rows = await apiFetch<CustomerGood[]>(buildExportQuery())
    if (!rows.length) throw new Error('За выбранный период записей нет')

    const text = formatExportRows(rows)
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

    showToast('success', 'Данные скопированы')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось скопировать')
  }
  finally {
    exporting.value = false
  }
}

async function togglePaid(item: CustomerGood) {
  try {
    const updated = await apiFetch<CustomerGood>(`/api/goods/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: !item.has_paid }),
    })
    const idx = goods.value.findIndex(g => g.id === item.id)
    if (idx !== -1) goods.value[idx] = updated
    haptic('light')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось обновить')
  }
}

async function removeGood(item: CustomerGood) {
  const ok = await confirm({
    title: 'Удалить запись?',
    message: `«${item.name}» будет перемещена в корзину.`,
    confirmLabel: 'В корзину',
    danger: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/trash/goods/${item.id}`, { method: 'DELETE' })
    goods.value = goods.value.filter(g => g.id !== item.id)
    showToast('success', 'Перемещено в корзину')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось удалить')
  }
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}
</script>

<template>
  <div>
    <PageHeader title="Записи" show-refresh :refreshing="loadingGoods" @refresh="load" />

    <div class="space-y-3 pb-6">
      <FiltersSheet
        v-model="filtersOpen"
        title="Фильтры и экспорт"
        :active="filtersActive"
        @clear="clearFilters"
      >
        <label class="ui-field">
          <span class="ui-label">Поиск</span>
          <input v-model="search" type="text" autocomplete="off" placeholder="Имя или телефон" class="ui-input">
        </label>

        <label class="ui-field">
          <span class="ui-label">Статус оплаты</span>
          <select v-model="paidFilter" class="ui-input">
            <option value="all">Все</option>
            <option value="paid">Оплачено</option>
            <option value="unpaid">Не оплачено</option>
          </select>
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="ui-field">
            <span class="ui-label">Дата с</span>
            <input v-model="dateFrom" type="date" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">Дата по</span>
            <input v-model="dateTo" type="date" class="ui-input">
          </label>
        </div>

        <div class="rounded-[1.35rem] border border-white/60 bg-white/40 p-3">
          <p class="mb-2 text-xs font-medium text-muted">Экспорт за выбранный период</p>
          <button type="button" class="ui-btn-primary w-full py-3 text-sm" :disabled="exporting" @click="copyExport">
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
        <UiSpinner v-if="state === 'loading'" />
        <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

        <template v-else>
          <p class="mb-3 px-1 text-xs font-medium text-muted">
            Найдено: {{ goods.length }}
            <span v-if="loadingGoods"> · обновление…</span>
          </p>

          <ul v-if="goods.length" class="space-y-2">
            <GoodsRow
              v-for="item in goods"
              :key="item.id"
              :name="item.name"
              :phone="item.phone"
              :meta="`${formatWeight(item.weight)} · ${formatPrice(item.price)} · ${formatDateTime(item.created_at)}`"
              :initiator="item.initiator"
              :has-paid="item.has_paid"
              @toggle-paid="togglePaid(item)"
              @remove="removeGood(item)"
            />
          </ul>

          <UiEmpty
            v-else
            :message="filtersActive ? 'Ничего не найдено по заданным фильтрам.' : 'Записей пока нет.'"
          />
        </template>
      </div>
    </div>

    <UiToast :toast="toast" />
  </div>
</template>
