<script setup lang="ts">
type FinanceType = 'income' | 'expense'

interface FinanceRecord {
  id: number
  type: FinanceType
  amount: number
  note: string
  created_by: string | null
  created_at: string
}

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { confirm } = useConfirm()
const { formatPrice, formatDateTime } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const records = ref<FinanceRecord[]>([])
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)

const filtersOpen = ref(false)
const typeFilter = ref<'all' | FinanceType>('all')
const search = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const sheetOpen = ref(false)
const editing = ref<FinanceRecord | null>(null)
const formType = ref<FinanceType>('expense')
const formAmount = ref('')
const formNote = ref('')
const saving = ref(false)

const filtersActive = computed(() =>
  typeFilter.value !== 'all'
  || search.value.trim().length > 0
  || !!dateFrom.value
  || !!dateTo.value,
)

let searchDebounce: ReturnType<typeof setTimeout> | undefined

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch([typeFilter, dateFrom, dateTo], () => {
  if (state.value === 'ok' || state.value === 'error') load()
})

watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (state.value === 'ok' || state.value === 'error') load()
  }, 300)
})

function buildQuery() {
  const params = new URLSearchParams()
  if (typeFilter.value !== 'all') params.set('type', typeFilter.value)
  if (search.value.trim()) params.set('search', search.value.trim())
  if (dateFrom.value) params.set('dateFrom', dateFrom.value)
  if (dateTo.value) params.set('dateTo', dateTo.value)
  const qs = params.toString()
  return qs ? `/api/finance?${qs}` : '/api/finance'
}

async function load() {
  if (!ready.value) return
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    records.value = await apiFetch<FinanceRecord[]>(buildQuery())
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить записи'
  }
}

function clearFilters() {
  typeFilter.value = 'all'
  search.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

function openCreate(type: FinanceType = 'expense') {
  editing.value = null
  formType.value = type
  formAmount.value = ''
  formNote.value = ''
  sheetOpen.value = true
}

function openEdit(item: FinanceRecord) {
  editing.value = item
  formType.value = item.type
  formAmount.value = String(item.amount)
  formNote.value = item.note
  sheetOpen.value = true
}

const canSave = computed(() => {
  const amount = Number(formAmount.value.replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 && formNote.value.trim().length > 0 && !saving.value
})

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    const payload = {
      type: formType.value,
      amount: Number(formAmount.value.replace(',', '.')),
      note: formNote.value.trim(),
    }

    if (editing.value) {
      const updated = await apiFetch<FinanceRecord>(`/api/finance/${editing.value.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      const idx = records.value.findIndex(r => r.id === updated.id)
      if (idx !== -1) records.value[idx] = updated
      showToast('success', 'Запись обновлена')
    }
    else {
      const created = await apiFetch<FinanceRecord>('/api/finance', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      records.value.unshift(created)
      showToast('success', formType.value === 'income' ? 'Доход добавлен' : 'Расход добавлен')
    }

    sheetOpen.value = false
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось сохранить')
  }
  finally {
    saving.value = false
  }
}

async function removeRecord(item: FinanceRecord) {
  const ok = await confirm({
    title: 'Удалить запись?',
    message: `«${item.note}» будет перемещена в корзину.`,
    confirmLabel: 'В корзину',
    danger: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/finance/${item.id}`, { method: 'DELETE' })
    records.value = records.value.filter(r => r.id !== item.id)
    showToast('success', 'Перемещено в корзину')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось удалить')
  }
}

const totals = computed(() => {
  let income = 0
  let expense = 0
  for (const r of records.value) {
    if (r.type === 'income') income += r.amount
    else expense += r.amount
  }
  return { income, expense, net: income - expense }
})
</script>

<template>
  <div>
    <PageHeader title="Финансы" subtitle="Доходы и расходы" show-refresh @refresh="load">
      <template #actions>
        <button type="button" class="ui-chip text-brand" @click="openCreate('income')">
          + Доход
        </button>
        <button type="button" class="ui-chip text-danger" @click="openCreate('expense')">
          + Расход
        </button>
      </template>
    </PageHeader>

    <div class="space-y-3 pb-6">
      <FiltersSheet
        v-model="filtersOpen"
        title="Фильтры"
        :active="filtersActive"
        @clear="clearFilters"
      >
        <label class="ui-field">
          <span class="ui-label">Тип</span>
          <select v-model="typeFilter" class="ui-input">
            <option value="all">Все</option>
            <option value="income">Доходы</option>
            <option value="expense">Расходы</option>
          </select>
        </label>

        <label class="ui-field">
          <span class="ui-label">Поиск</span>
          <input v-model="search" type="text" autocomplete="off" placeholder="Причина / комментарий" class="ui-input">
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
          <section class="ui-card mb-3 grid grid-cols-3 gap-2 px-3 py-3">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Доходы</p>
              <p class="text-sm font-extrabold tabular-nums text-success">{{ formatPrice(totals.income) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Расходы</p>
              <p class="text-sm font-extrabold tabular-nums text-danger">{{ formatPrice(totals.expense) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wide text-muted">Сальдо</p>
              <p class="text-sm font-extrabold tabular-nums text-ink">{{ formatPrice(totals.net) }}</p>
            </div>
          </section>

          <p class="mb-3 px-1 text-xs font-medium text-muted">
            Найдено: {{ records.length }}
          </p>

          <ul v-if="records.length" class="space-y-2">
            <li
              v-for="item in records"
              :key="item.id"
              class="ui-card flex items-start gap-3 px-4 py-3.5"
            >
              <span
                class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                :class="item.type === 'income'
                  ? 'bg-success-soft text-success'
                  : 'bg-danger-soft text-danger'"
              >
                {{ item.type === 'income' ? '+' : '−' }}
              </span>
              <button type="button" class="min-w-0 flex-1 text-left" @click="openEdit(item)">
                <p class="truncate text-[15px] font-extrabold text-ink">{{ item.note }}</p>
                <p class="mt-0.5 text-xs font-medium text-muted">
                  {{ formatDateTime(item.created_at) }}
                  <span v-if="item.created_by"> · {{ item.created_by }}</span>
                </p>
              </button>
              <div class="flex shrink-0 flex-col items-end gap-2">
                <span
                  class="text-sm font-extrabold tabular-nums"
                  :class="item.type === 'income' ? 'text-success' : 'text-danger'"
                >
                  {{ item.type === 'income' ? '+' : '−' }}{{ formatPrice(item.amount) }}
                </span>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-danger-soft text-danger"
                  aria-label="Удалить"
                  @click="removeRecord(item)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            </li>
          </ul>

          <UiEmpty
            v-else
            :message="filtersActive ? 'Ничего не найдено по фильтрам.' : 'Пока нет финансовых записей.'"
          />
        </template>
      </div>
    </div>

    <UiSheet v-model="sheetOpen">
      <div class="space-y-4">
        <h2 class="text-2xl font-extrabold tracking-tight text-ink">
          {{ editing ? 'Редактировать' : (formType === 'income' ? 'Новый доход' : 'Новый расход') }}
        </h2>

        <div class="ui-glass-strong grid grid-cols-2 gap-1 rounded-blob p-1.5">
          <button
            type="button"
            class="rounded-full py-2.5 text-sm font-extrabold transition"
            :class="formType === 'expense' ? 'ui-chip-active' : 'text-muted'"
            @click="formType = 'expense'"
          >
            Расход
          </button>
          <button
            type="button"
            class="rounded-full py-2.5 text-sm font-extrabold transition"
            :class="formType === 'income' ? 'ui-chip-active' : 'text-muted'"
            @click="formType = 'income'"
          >
            Доход
          </button>
        </div>

        <label class="ui-field">
          <span class="ui-label">Сумма (TJS)</span>
          <input
            v-model="formAmount"
            type="text"
            inputmode="decimal"
            placeholder="0"
            class="ui-input text-center text-2xl font-extrabold tabular-nums"
          >
        </label>

        <label class="ui-field">
          <span class="ui-label">Причина</span>
          <input
            v-model="formNote"
            type="text"
            autocomplete="off"
            placeholder="Зарплата, ремонт, обед…"
            class="ui-input"
          >
        </label>

        <button
          type="button"
          class="ui-btn-primary w-full"
          :disabled="!canSave"
          @click="save"
        >
          {{ saving ? 'Сохранение…' : (editing ? 'Сохранить' : 'Добавить') }}
        </button>
      </div>
    </UiSheet>

    <UiToast :toast="toast" />
  </div>
</template>
