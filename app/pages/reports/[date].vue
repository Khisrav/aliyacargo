<script setup lang="ts">
import type { DailyReport } from '#shared/types/domain'

const route = useRoute()
const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatNumber, formatDate, formatDateTime } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const report = ref<DailyReport | null>(null)
const recalculating = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)

const date = computed(() => String(route.params.date ?? ''))

function shiftDate(key: string, days: number) {
  const shifted = new Date(`${key}T12:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

const todayKey = computed(() =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dushanbe',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()),
)

const prevDate = computed(() => shiftDate(date.value, -1))
const nextDate = computed(() => (date.value >= todayKey.value ? null : shiftDate(date.value, 1)))

const totalExpense = computed(() =>
  report.value ? report.value.acceptance_cost + report.value.expense_total : 0,
)
const totalIncome = computed(() =>
  report.value ? report.value.payments_revenue + report.value.income_total : 0,
)

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(date, () => {
  if (ready.value) load()
})

async function load() {
  state.value = 'loading'
  try {
    report.value = await apiFetch<DailyReport>(`/api/reports/${date.value}`)
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

async function recalculate() {
  if (recalculating.value) return
  recalculating.value = true
  try {
    report.value = await apiFetch<DailyReport>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ date: date.value }),
    })
    showToast('success', 'Отчёт пересчитан')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось пересчитать')
  }
  finally {
    recalculating.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="formatDate(date)" :subtitle="date === todayKey ? 'Сегодня · день не закрыт' : 'Отчёт за день'" back-to="/reports">
      <template #actions>
        <button
          type="button"
          class="ui-chip text-brand disabled:opacity-50"
          :disabled="recalculating || state === 'loading'"
          @click="recalculate"
        >
          {{ recalculating ? '…' : 'Пересчитать' }}
        </button>
      </template>
    </PageHeader>

    <div class="space-y-4 px-4 pb-8">
      <div class="flex items-center gap-2">
        <NuxtLink :to="`/reports/${prevDate}`" class="ui-chip flex-1 text-center">
          ← {{ formatDate(prevDate) }}
        </NuxtLink>
        <NuxtLink v-if="nextDate" :to="`/reports/${nextDate}`" class="ui-chip flex-1 text-center">
          {{ formatDate(nextDate) }} →
        </NuxtLink>
      </div>

      <UiSpinner v-if="state === 'loading'" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

      <template v-else-if="report">
        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Итог дня</h2>
          <p
            class="text-3xl font-extrabold tabular-nums"
            :class="report.net_profit >= 0 ? 'text-success' : 'text-danger'"
          >
            {{ formatPrice(report.net_profit) }}
          </p>
          <div class="space-y-2 border-t border-white/60 pt-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Приход</span>
              <span class="font-extrabold tabular-nums text-success">{{ formatPrice(totalIncome) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Расход</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(totalExpense) }}</span>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Собрано за день</h2>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Шт</p>
              <p class="text-lg font-extrabold tabular-nums">{{ report.payments_count }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Вес</p>
              <p class="text-lg font-extrabold tabular-nums">{{ formatWeight(report.payments_weight) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Сумма</p>
              <p class="text-lg font-extrabold tabular-nums text-success">{{ formatPrice(report.payments_revenue) }}</p>
            </div>
          </div>
          <div v-if="report.payments_by_collector.length" class="space-y-1.5 border-t border-white/60 pt-2 text-sm">
            <div
              v-for="c in report.payments_by_collector"
              :key="c.collector"
              class="flex justify-between"
            >
              <span class="text-muted">{{ c.collector }} · {{ c.count }} шт</span>
              <span class="font-extrabold tabular-nums">{{ formatPrice(c.amount) }}</span>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Сортировка</h2>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Товаров</p>
              <p class="font-extrabold tabular-nums">{{ formatNumber(report.goods_count) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Вес</p>
              <p class="font-extrabold tabular-nums">{{ formatWeight(report.goods_weight) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">На сумму</p>
              <p class="font-extrabold tabular-nums">{{ formatPrice(report.goods_revenue) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Новых клиентов</p>
              <p class="font-extrabold tabular-nums">{{ report.new_clients_count }}</p>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Остатки</h2>
          <p class="text-xs font-medium text-muted">Не оплачено из товаров этого дня</p>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Шт</p>
              <p class="text-lg font-extrabold tabular-nums text-danger">{{ report.unpaid_count }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Вес</p>
              <p class="text-lg font-extrabold tabular-nums">{{ formatWeight(report.unpaid_weight) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Сумма</p>
              <p class="text-lg font-extrabold tabular-nums text-danger">{{ formatPrice(report.unpaid_revenue) }}</p>
            </div>
          </div>
          <div class="space-y-2 border-t border-white/60 pt-2 text-sm">
            <p class="text-xs font-medium text-muted">Общий долг на конец дня</p>
            <div class="flex justify-between">
              <span class="text-muted">{{ report.debt_count }} шт · {{ report.debt_clients_count }} клиент.</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(report.debt_revenue) }}</span>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Приёмки</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Принято</span>
              <span class="font-extrabold tabular-nums">
                {{ report.acceptances_count }} шт · {{ formatWeight(report.acceptance_weight) }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Оплачено поставщику</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(report.acceptance_cost) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Закрыто приёмок</span>
              <span class="font-extrabold tabular-nums">{{ report.acceptances_closed }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Мусор</span>
              <span class="font-extrabold tabular-nums">{{ formatWeight(report.waste_weight) }}</span>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Финансы</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Прочие доходы · {{ report.income_count }}</span>
              <span class="font-extrabold tabular-nums text-success">{{ formatPrice(report.income_total) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Прочие расходы · {{ report.expense_count }}</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(report.expense_total) }}</span>
            </div>
          </div>
          <ul v-if="report.finance_items.length" class="space-y-1.5 border-t border-white/60 pt-2 text-sm">
            <li
              v-for="(item, i) in report.finance_items"
              :key="i"
              class="flex items-start justify-between gap-3"
            >
              <span class="min-w-0 flex-1 text-muted">
                {{ item.note }}
                <span v-if="item.created_by" class="text-[11px]">· {{ item.created_by }}</span>
              </span>
              <span
                class="shrink-0 font-extrabold tabular-nums"
                :class="item.type === 'income' ? 'text-success' : 'text-danger'"
              >
                {{ item.type === 'income' ? '+' : '−' }}{{ formatPrice(item.amount) }}
              </span>
            </li>
          </ul>
          <p v-else class="text-xs font-medium text-muted">Записей за день нет</p>
        </section>

        <p class="px-1 text-center text-[11px] font-medium text-muted">
          Сформирован {{ formatDateTime(report.generated_at) }}
        </p>
      </template>
    </div>

    <UiToast :toast="toast" />
  </div>
</template>
