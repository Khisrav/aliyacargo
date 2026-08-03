<script setup lang="ts">
import type { Acceptance } from '#shared/types/domain'

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight, formatDate } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const items = ref<Acceptance[]>([])
const filter = ref<'all' | 'open' | 'closed'>('all')

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(filter, () => {
  if (state.value === 'ok' || state.value === 'error') load()
})

async function load() {
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    const qs = filter.value === 'all' ? '' : `?status=${filter.value}`
    items.value = await apiFetch<Acceptance[]>(`/api/acceptances${qs}`)
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить'
    haptic('error')
  }
}
</script>

<template>
  <div>
    <PageHeader title="Приёмка" subtitle="Партии с границы" show-refresh :refreshing="state === 'loading'" @refresh="load">
      <template #actions>
        <NuxtLink to="/acceptances/new" class="ui-icon-btn" aria-label="Новая приёмка">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="space-y-4 px-4 pb-8">
      <div class="ui-glass flex rounded-full p-1">
        <button
          v-for="opt in ([{ v: 'all', l: 'Все' }, { v: 'open', l: 'Открытые' }, { v: 'closed', l: 'Закрытые' }] as const)"
          :key="opt.v"
          type="button"
          class="flex-1 rounded-full py-2 text-xs font-extrabold transition"
          :class="filter === opt.v ? 'bg-brand text-white shadow' : 'text-muted'"
          @click="filter = opt.v"
        >
          {{ opt.l }}
        </button>
      </div>

      <UiSpinner v-if="state === 'loading'" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />
      <UiEmpty v-else-if="!items.length" title="Нет приёмок" description="Создайте первую партию с границы" />

      <ul v-else class="space-y-3">
        <li v-for="item in items" :key="item.id">
          <NuxtLink
            :to="`/acceptances/${item.id}`"
            class="ui-card block px-4 py-4 transition active:scale-[0.99]"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-[15px] font-extrabold text-ink">
                  {{ formatDate(item.accepted_at) }}
                </p>
                <p class="mt-1 text-xs font-medium text-muted">
                  {{ formatWeight(item.total_weight) }} · {{ item.goods_count ?? 0 }} тов.
                  <span v-if="item.sorted_weight != null"> · отсорт. {{ formatWeight(item.sorted_weight) }}</span>
                </p>
              </div>
              <span
                class="rounded-full px-3 py-1 text-[11px] font-extrabold"
                :class="item.status === 'open'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'"
              >
                {{ item.status === 'open' ? 'Открыта' : 'Закрыта' }}
              </span>
            </div>
            <div class="mt-3 flex justify-between text-sm">
              <span class="text-muted">Оплачено посреднику</span>
              <span class="font-extrabold tabular-nums text-ink">{{ formatPrice(item.paid_tjs) }}</span>
            </div>
            <div v-if="item.status === 'closed' && item.waste_weight != null" class="mt-1 flex justify-between text-sm">
              <span class="text-muted">Мусор</span>
              <span class="font-extrabold tabular-nums text-danger">{{ formatWeight(item.waste_weight) }}</span>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
