<script setup lang="ts">
import type { AcceptanceStatsDetail } from '#shared/types/domain'
import { formatPhone } from '#shared/utils/phone'

const route = useRoute()
const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatDate, formatDateTime } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const stats = ref<AcceptanceStatsDetail | null>(null)

const id = computed(() => String(route.params.id ?? ''))

const debtors = computed(() => stats.value?.clients.filter(c => c.unpaid > 0) ?? [])

/** Share of the batch that must be collected before it stops losing money. */
const breakEvenRate = computed(() => {
  if (!stats.value?.total_revenue) return 0
  return Math.round((stats.value.cost / stats.value.total_revenue) * 1000) / 10
})

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

async function load() {
  state.value = 'loading'
  try {
    stats.value = await apiFetch<AcceptanceStatsDetail>(`/api/stats/acceptances/${id.value}`)
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
      :title="stats ? formatDate(stats.accepted_at) : 'Приёмка'"
      subtitle="Готовность приёмки"
      back-to="/stats/acceptances"
      show-refresh
      :refreshing="state === 'loading'"
      @refresh="load"
    />

    <div class="space-y-4 px-4 pb-8">
      <UiSpinner v-if="state === 'loading'" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

      <template v-else-if="stats">
        <section class="ui-card space-y-3 px-4 py-4">
          <div class="flex items-baseline justify-between">
            <h2 class="text-sm font-extrabold text-ink">Выкуплено клиентами</h2>
            <span class="text-2xl font-extrabold tabular-nums" :class="rateTextClass(stats.payment_rate)">
              {{ stats.payment_rate }}%
            </span>
          </div>
          <div class="h-2.5 w-full overflow-hidden rounded-full bg-white/60">
            <div
              class="h-full rounded-full transition-[width] duration-500"
              :class="barClass(stats.payment_rate)"
              :style="{ width: `${Math.min(100, stats.payment_rate)}%` }"
            />
          </div>
          <div class="space-y-2 border-t border-white/60 pt-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Выкуплено · {{ stats.paid_count }} тов.</span>
              <span class="font-extrabold tabular-nums text-success">{{ formatPrice(stats.paid_revenue) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Осталось · {{ stats.unpaid_count }} тов.</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(stats.unpaid_revenue) }}</span>
            </div>
            <div class="flex justify-between border-t border-white/60 pt-2">
              <span class="font-bold text-ink">Вся партия</span>
              <span class="font-extrabold tabular-nums">{{ formatPrice(stats.total_revenue) }}</span>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Деньги</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Закупка · {{ stats.cost_per_kg }} с./кг</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(stats.cost) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Прибыль сейчас</span>
              <span
                class="font-extrabold tabular-nums"
                :class="stats.realized >= 0 ? 'text-success' : 'text-danger'"
              >
                {{ formatPrice(stats.realized) }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Прибыль при полной оплате</span>
              <span
                class="font-extrabold tabular-nums"
                :class="stats.margin >= 0 ? 'text-success' : 'text-danger'"
              >
                {{ formatPrice(stats.margin) }}
              </span>
            </div>
            <div v-if="breakEvenRate > 0" class="flex justify-between border-t border-white/60 pt-2">
              <span class="text-muted">Окупается при</span>
              <span
                class="font-extrabold tabular-nums"
                :class="stats.payment_rate >= breakEvenRate ? 'text-success' : 'text-danger'"
              >
                {{ breakEvenRate }}%
              </span>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <div class="flex items-baseline justify-between">
            <h2 class="text-sm font-extrabold text-ink">Вес</h2>
            <span class="text-sm font-extrabold tabular-nums text-muted">
              отсортировано {{ stats.sorting_rate }}%
            </span>
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Принято от посредника</span>
              <span class="font-extrabold tabular-nums">{{ formatWeight(stats.total_weight) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Разобрано по клиентам</span>
              <span class="font-extrabold tabular-nums">{{ formatWeight(stats.sorted_weight) }}</span>
            </div>
            <div v-if="stats.status === 'open'" class="flex justify-between">
              <span class="text-muted">Ещё не разобрано</span>
              <span class="font-extrabold tabular-nums text-amber-700">{{ formatWeight(stats.unsorted_weight) }}</span>
            </div>
            <div v-if="stats.waste_weight != null" class="flex justify-between">
              <span class="text-muted">Мусор · {{ stats.waste_rate }}%</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatWeight(stats.waste_weight) }}</span>
            </div>
            <div v-if="stats.removed_weight > 0" class="flex justify-between">
              <span class="text-muted">Удалено после закрытия</span>
              <span class="font-extrabold tabular-nums text-muted">{{ formatWeight(stats.removed_weight) }}</span>
            </div>
            <div class="flex justify-between border-t border-white/60 pt-2">
              <span class="text-muted">Оплачено / не оплачено</span>
              <span class="font-extrabold tabular-nums">
                {{ formatWeight(stats.paid_weight) }} / {{ formatWeight(stats.unpaid_weight) }}
              </span>
            </div>
          </div>
        </section>

        <section class="ui-card space-y-3 px-4 py-4">
          <h2 class="text-sm font-extrabold text-ink">Партия</h2>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Товаров</p>
              <p class="font-extrabold tabular-nums">{{ stats.goods_count }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Клиентов</p>
              <p class="font-extrabold tabular-nums">{{ stats.clients_count }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Цена за кг</p>
              <p class="font-extrabold tabular-nums">{{ stats.price_per_kg }} с.</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase text-muted">Статус</p>
              <p class="font-extrabold">{{ stats.status === 'open' ? 'Открыта' : 'Закрыта' }}</p>
            </div>
          </div>
          <div v-if="stats.first_payment_at" class="space-y-2 border-t border-white/60 pt-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Первая оплата</span>
              <span class="font-extrabold tabular-nums">{{ formatDateTime(stats.first_payment_at) }}</span>
            </div>
            <div v-if="stats.last_payment_at" class="flex justify-between">
              <span class="text-muted">Последняя оплата</span>
              <span class="font-extrabold tabular-nums">{{ formatDateTime(stats.last_payment_at) }}</span>
            </div>
          </div>
        </section>

        <NuxtLink :to="`/acceptances/${stats.id}`" class="ui-card flex items-center justify-between px-4 py-3.5">
          <span class="font-extrabold text-ink">Открыть приёмку</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="text-muted">
            <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </NuxtLink>

        <section v-if="debtors.length" class="space-y-2">
          <h2 class="px-1 text-sm font-extrabold text-ink">
            Не выкупили · {{ debtors.length }}
          </h2>
          <NuxtLink
            v-for="c in debtors"
            :key="c.id"
            :to="`/clients/${c.id}`"
            class="ui-card flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate font-extrabold text-ink">{{ c.name }}</p>
              <p class="text-xs text-muted">
                +992 {{ formatPhone(c.phone) }} · {{ c.goods_count }} тов. · {{ formatWeight(c.weight) }}
              </p>
            </div>
            <p class="shrink-0 font-extrabold tabular-nums text-danger">{{ formatPrice(c.unpaid) }}</p>
          </NuxtLink>
        </section>
      </template>
    </div>
  </div>
</template>
