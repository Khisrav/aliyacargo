<script setup lang="ts">
import type { Report } from '#shared/types/report'

interface PreviewResponse {
  draft: Omit<Report, 'id' | 'created_by' | 'created_at'>
  todayExists: boolean
  existingId: number | null
}

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatDate } = useFormatters()
const router = useRouter()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const saving = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)

const reportDate = ref('')
const pricePerKg = ref('')
const costPerKg = ref('')
const goodsCount = ref('')
const totalWeight = ref('')
const paidCount = ref('')
const paidWeight = ref('')
const paidRevenue = ref('')
const unpaidCount = ref('')
const unpaidWeight = ref('')
const unpaidRevenue = ref('')
const otherIncome = ref('')
const otherExpense = ref('')
const note = ref('')

function num(v: string) {
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function int(v: string) {
  return Math.round(num(v))
}

const derived = computed(() => {
  const total_weight = num(totalWeight.value)
  const paid_revenue = num(paidRevenue.value)
  const other_income = num(otherIncome.value)
  const other_expense = num(otherExpense.value)
  const cost_per_kg = num(costPerKg.value)
  const cargo_cost = Math.round(total_weight * cost_per_kg * 100) / 100
  const cargo_margin = Math.round((paid_revenue - cargo_cost) * 100) / 100
  const income_total = Math.round((paid_revenue + other_income) * 100) / 100
  const expense_total = Math.round((cargo_cost + other_expense) * 100) / 100
  const net_profit = Math.round((income_total - expense_total) * 100) / 100
  return { cargo_cost, cargo_margin, income_total, expense_total, net_profit }
})

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await loadPreview()
}, { immediate: true })

async function loadPreview() {
  state.value = 'loading'
  try {
    const preview = await apiFetch<PreviewResponse>('/api/reports/preview')
    if (preview.todayExists && preview.existingId) {
      await router.replace(`/reports/${preview.existingId}`)
      return
    }
    const d = preview.draft
    reportDate.value = d.report_date
    pricePerKg.value = String(d.price_per_kg)
    costPerKg.value = String(d.cost_per_kg)
    goodsCount.value = String(d.goods_count)
    totalWeight.value = String(d.total_weight)
    paidCount.value = String(d.paid_count)
    paidWeight.value = String(d.paid_weight)
    paidRevenue.value = String(d.paid_revenue)
    unpaidCount.value = String(d.unpaid_count)
    unpaidWeight.value = String(d.unpaid_weight)
    unpaidRevenue.value = String(d.unpaid_revenue)
    otherIncome.value = String(d.other_income)
    otherExpense.value = String(d.other_expense)
    note.value = d.note || ''
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить данные'
  }
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const created = await apiFetch<Report>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        report_date: reportDate.value,
        price_per_kg: num(pricePerKg.value),
        cost_per_kg: num(costPerKg.value),
        goods_count: int(goodsCount.value),
        total_weight: num(totalWeight.value),
        paid_count: int(paidCount.value),
        paid_weight: num(paidWeight.value),
        paid_revenue: num(paidRevenue.value),
        unpaid_count: int(unpaidCount.value),
        unpaid_weight: num(unpaidWeight.value),
        unpaid_revenue: num(unpaidRevenue.value),
        other_income: num(otherIncome.value),
        other_expense: num(otherExpense.value),
        note: note.value,
      }),
    })
    showToast('success', 'Отчёт сохранён')
    await router.replace(`/reports/${created.id}`)
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось сохранить')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Новый отчёт"
      :subtitle="reportDate ? formatDate(reportDate) : 'Сегодня'"
      back-to="/reports"
    />

    <UiSpinner v-if="state === 'loading'" />
    <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="loadPreview" />

    <main v-else class="space-y-4 px-4 pb-8">
      <p class="text-xs font-medium text-muted">
        Данные за сегодня подставлены автоматически. Можно поправить перед сохранением. После сохранения отчёт нельзя изменить или удалить.
      </p>

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Тарифы</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="ui-field">
            <span class="ui-label">Цена / кг</span>
            <input v-model="pricePerKg" type="text" inputmode="decimal" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">Себест. / кг</span>
            <input v-model="costPerKg" type="text" inputmode="decimal" class="ui-input">
          </label>
        </div>
      </section>

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Склад сегодня</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="ui-field">
            <span class="ui-label">Записей</span>
            <input v-model="goodsCount" type="text" inputmode="numeric" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">Вес, кг</span>
            <input v-model="totalWeight" type="text" inputmode="decimal" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">Оплачено, шт</span>
            <input v-model="paidCount" type="text" inputmode="numeric" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">Оплачено, кг</span>
            <input v-model="paidWeight" type="text" inputmode="decimal" class="ui-input">
          </label>
        </div>
        <label class="ui-field">
          <span class="ui-label">Выручка (оплачено)</span>
          <input v-model="paidRevenue" type="text" inputmode="decimal" class="ui-input">
        </label>
      </section>

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Остатки (неоплачено сегодня)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="ui-field">
            <span class="ui-label">Записей</span>
            <input v-model="unpaidCount" type="text" inputmode="numeric" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">Вес, кг</span>
            <input v-model="unpaidWeight" type="text" inputmode="decimal" class="ui-input">
          </label>
        </div>
        <label class="ui-field">
          <span class="ui-label">Сумма долга</span>
          <input v-model="unpaidRevenue" type="text" inputmode="decimal" class="ui-input">
        </label>
      </section>

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Прочие операции</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="ui-field">
            <span class="ui-label">Доходы</span>
            <input v-model="otherIncome" type="text" inputmode="decimal" class="ui-input">
          </label>
          <label class="ui-field">
            <span class="ui-label">Расходы</span>
            <input v-model="otherExpense" type="text" inputmode="decimal" class="ui-input">
          </label>
        </div>
      </section>

      <section class="ui-card space-y-3 px-4 py-4">
        <h2 class="text-sm font-bold text-ink">Итоги (авто)</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-muted">Себестоимость ({{ formatWeight(num(totalWeight)) }} × {{ formatPrice(num(costPerKg)) }})</span>
            <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(derived.cargo_cost) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">Маржа груза</span>
            <span class="font-extrabold tabular-nums text-brand">{{ formatPrice(derived.cargo_margin) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">Доходы всего</span>
            <span class="font-extrabold tabular-nums text-success">{{ formatPrice(derived.income_total) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-muted">Расходы всего</span>
            <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(derived.expense_total) }}</span>
          </div>
          <div class="flex justify-between gap-3 border-t border-white/50 pt-2">
            <span class="font-bold text-ink">Чистая прибыль</span>
            <span
              class="font-extrabold tabular-nums"
              :class="derived.net_profit >= 0 ? 'text-brand' : 'text-danger'"
            >
              {{ formatPrice(derived.net_profit) }}
            </span>
          </div>
        </div>
      </section>

      <label class="ui-field">
        <span class="ui-label">Комментарий</span>
        <textarea v-model="note" rows="3" class="ui-input resize-none" placeholder="Необязательно" />
      </label>

      <button
        type="button"
        class="ui-btn-primary w-full py-3.5 text-sm"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Сохранение…' : 'Сохранить отчёт' }}
      </button>
    </main>

    <UiToast v-if="toast" :type="toast.type" :message="toast.message" />
  </div>
</template>
