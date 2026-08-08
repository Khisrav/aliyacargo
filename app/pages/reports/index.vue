<script setup lang="ts">
import type { DailyReport } from '#shared/types/domain'

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatDate } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const reports = ref<DailyReport[]>([])

const totals = computed(() => reports.value.reduce((acc, r) => ({
  payments: acc.payments + r.payments_revenue,
  expenses: acc.expenses + r.acceptance_cost + r.expense_total,
  net: acc.net + r.net_profit,
}), { payments: 0, expenses: 0, net: 0 }))

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

async function load() {
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    // The cron job closes each day at midnight; today's row is built on demand.
    await apiFetch('/api/reports', { method: 'POST', body: JSON.stringify({}) }).catch(() => null)
    reports.value = await apiFetch<DailyReport[]>('/api/reports')
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить'
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Отчёты"
      subtitle="Итоги дня · закрытие в 00:00"
      show-refresh
      :refreshing="state === 'loading'"
      @refresh="load"
    />

    <div class="space-y-4 px-4 pb-8">
      <UiSpinner v-if="state === 'loading'" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />
      <UiEmpty v-else-if="!reports.length" title="Отчётов пока нет" />

      <template v-else>
        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">За {{ reports.length }} дн.</h2>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Собрано</p>
              <p class="text-base font-extrabold tabular-nums text-success">{{ formatPrice(totals.payments) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Расходы</p>
              <p class="text-base font-extrabold tabular-nums text-danger">{{ formatPrice(totals.expenses) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Чистыми</p>
              <p
                class="text-base font-extrabold tabular-nums"
                :class="totals.net >= 0 ? 'text-success' : 'text-danger'"
              >
                {{ formatPrice(totals.net) }}
              </p>
            </div>
          </div>
        </section>

        <ul class="space-y-2">
          <li v-for="r in reports" :key="r.report_date">
            <NuxtLink
              :to="`/reports/${r.report_date}`"
              class="ui-card flex items-center gap-3 px-4 py-3.5 transition active:scale-[0.99]"
            >
              <div class="min-w-0 flex-1">
                <p class="text-[15px] font-extrabold text-ink">{{ formatDate(r.report_date) }}</p>
                <p class="mt-0.5 text-xs font-medium text-muted">
                  {{ r.goods_count }} тов. · {{ formatWeight(r.goods_weight) }} · собрано {{ r.payments_count }}
                </p>
                <p v-if="r.debt_revenue > 0" class="mt-0.5 text-[11px] font-bold text-muted">
                  Остаток долга {{ formatPrice(r.debt_revenue) }}
                </p>
              </div>
              <div class="shrink-0 text-right">
                <p
                  class="text-sm font-extrabold tabular-nums"
                  :class="r.net_profit >= 0 ? 'text-success' : 'text-danger'"
                >
                  {{ formatPrice(r.net_profit) }}
                </p>
                <p class="text-[10px] font-bold text-muted">чистыми</p>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
