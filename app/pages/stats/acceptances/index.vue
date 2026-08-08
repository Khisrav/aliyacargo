<script setup lang="ts">
import type { AcceptanceStats } from '#shared/types/domain'

type Filter = 'all' | 'debt' | 'done'

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatDate } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const items = ref<AcceptanceStats[]>([])
const filter = ref<Filter>('all')

const FILTERS: { value: Filter, label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'debt', label: 'С долгом' },
  { value: 'done', label: 'Выкуплены' },
]

const visible = computed(() => {
  if (filter.value === 'debt') return items.value.filter(a => a.unpaid_revenue > 0)
  if (filter.value === 'done') return items.value.filter(a => a.unpaid_revenue === 0 && a.goods_count > 0)
  return items.value
})

const totals = computed(() => {
  const sum = items.value.reduce((acc, a) => ({
    cost: acc.cost + a.cost,
    revenue: acc.revenue + a.total_revenue,
    paid: acc.paid + a.paid_revenue,
    unpaid: acc.unpaid + a.unpaid_revenue,
  }), { cost: 0, revenue: 0, paid: 0, unpaid: 0 })

  return {
    ...sum,
    rate: sum.revenue ? Math.round((sum.paid / sum.revenue) * 1000) / 10 : 0,
  }
})

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

async function load() {
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    items.value = await apiFetch<AcceptanceStats[]>('/api/stats/acceptances')
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить'
  }
}

function barClass(rate: number) {
  if (rate >= 100) return 'bg-gradient-to-r from-emerald-300 to-success'
  if (rate >= 50) return 'bg-gradient-to-r from-teal-300 to-brand'
  return 'bg-gradient-to-r from-amber-300 to-accent'
}

function rateTextClass(rate: number) {
  if (rate >= 100) return 'text-success'
  if (rate >= 50) return 'text-ink'
  return 'text-danger'
}
</script>

<template>
  <div>
    <PageHeader
      title="Готовность приёмок"
      subtitle="Сколько выкуплено по каждой партии"
      back-to="/stats"
      show-refresh
      :refreshing="state === 'loading'"
      @refresh="load"
    />

    <div class="space-y-4 px-4 pb-8">
      <UiSpinner v-if="state === 'loading'" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />
      <UiEmpty v-else-if="!items.length" title="Нет приёмок" />

      <template v-else>
        <section class="ui-card space-y-3 px-4 py-4">
          <div class="flex items-baseline justify-between">
            <h2 class="text-sm font-extrabold text-ink">Всего по приёмкам</h2>
            <span class="text-lg font-extrabold tabular-nums" :class="rateTextClass(totals.rate)">
              {{ totals.rate }}%
            </span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-white/60">
            <div
              class="h-full rounded-full transition-[width] duration-500"
              :class="barClass(totals.rate)"
              :style="{ width: `${Math.min(100, totals.rate)}%` }"
            />
          </div>
          <div class="space-y-2 border-t border-white/60 pt-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Выкуплено</span>
              <span class="font-extrabold tabular-nums text-success">{{ formatPrice(totals.paid) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Осталось собрать</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(totals.unpaid) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Закупка</span>
              <span class="font-extrabold tabular-nums">{{ formatPrice(totals.cost) }}</span>
            </div>
          </div>
        </section>

        <div class="ui-glass flex rounded-full p-1">
          <button
            v-for="opt in FILTERS"
            :key="opt.value"
            type="button"
            class="flex-1 rounded-full py-2 text-xs font-extrabold transition"
            :class="filter === opt.value ? 'bg-brand text-white shadow' : 'text-muted'"
            @click="filter = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <UiEmpty v-if="!visible.length" title="Ничего не найдено" />

        <ul v-else class="space-y-3">
          <li v-for="a in visible" :key="a.id">
            <NuxtLink
              :to="`/stats/acceptances/${a.id}`"
              class="ui-card block px-4 py-4 transition active:scale-[0.99]"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[15px] font-extrabold text-ink">{{ formatDate(a.accepted_at) }}</p>
                  <p class="mt-0.5 text-xs font-medium text-muted">
                    {{ formatWeight(a.total_weight) }} · {{ a.goods_count }} тов. · {{ a.clients_count }} клиент.
                  </p>
                </div>
                <span
                  class="shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold"
                  :class="a.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'"
                >
                  {{ a.status === 'open' ? 'Открыта' : 'Закрыта' }}
                </span>
              </div>

              <div class="mt-3 flex items-center gap-3">
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-white/60">
                  <div
                    class="h-full rounded-full transition-[width] duration-500"
                    :class="barClass(a.payment_rate)"
                    :style="{ width: `${Math.min(100, a.payment_rate)}%` }"
                  />
                </div>
                <span class="shrink-0 text-sm font-extrabold tabular-nums" :class="rateTextClass(a.payment_rate)">
                  {{ a.payment_rate }}%
                </span>
              </div>

              <div class="mt-2.5 flex justify-between text-xs">
                <span class="text-muted">
                  {{ formatPrice(a.paid_revenue) }} из {{ formatPrice(a.total_revenue) }}
                </span>
                <span v-if="a.unpaid_revenue > 0" class="font-bold text-danger">
                  −{{ formatPrice(a.unpaid_revenue) }}
                </span>
                <span v-else-if="a.goods_count" class="font-bold text-success">Выкуплена</span>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
