<script setup lang="ts">
import type { ClientListItem } from '#shared/types/domain'
import { formatPhone } from '#shared/utils/phone'

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatWeight } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const clients = ref<ClientListItem[]>([])
const debtFilter = ref<'with_debt' | 'no_debt'>('with_debt')
const search = ref('')

let searchDebounce: ReturnType<typeof setTimeout> | undefined

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(debtFilter, () => {
  if (state.value === 'ok' || state.value === 'error') load()
})

watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    if (state.value === 'ok' || state.value === 'error') load()
  }, 300)
})

async function load() {
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    const params = new URLSearchParams({ debt: debtFilter.value })
    if (search.value.trim()) params.set('search', search.value.trim())
    clients.value = await apiFetch<ClientListItem[]>(`/api/clients?${params}`)
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
    <PageHeader title="Клиенты" show-refresh :refreshing="state === 'loading'" @refresh="load" />

    <div class="space-y-4 px-4 pb-8">
      <div class="ui-glass flex rounded-full p-1">
        <button
          type="button"
          class="flex-1 rounded-full py-2.5 text-xs font-extrabold transition"
          :class="debtFilter === 'with_debt' ? 'bg-brand text-white shadow' : 'text-muted'"
          @click="debtFilter = 'with_debt'"
        >
          С долгом
        </button>
        <button
          type="button"
          class="flex-1 rounded-full py-2.5 text-xs font-extrabold transition"
          :class="debtFilter === 'no_debt' ? 'bg-brand text-white shadow' : 'text-muted'"
          @click="debtFilter = 'no_debt'"
        >
          Без долга
        </button>
      </div>

      <label class="ui-field">
        <span class="ui-label">Поиск</span>
        <input v-model="search" type="text" class="ui-input" placeholder="Имя или телефон" autocomplete="off">
      </label>

      <UiSpinner v-if="state === 'loading'" />
      <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />
      <UiEmpty
        v-else-if="!clients.length"
        :title="debtFilter === 'with_debt' ? 'Нет должников' : 'Нет клиентов без долга'"
      />
      <ul v-else class="space-y-2">
        <li v-for="c in clients" :key="c.id">
          <NuxtLink :to="`/clients/${c.id}`" class="ui-card flex items-center gap-3 px-4 py-3.5 transition active:scale-[0.99]">
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] font-extrabold text-ink">{{ c.name }}</p>
              <p class="mt-0.5 text-xs font-medium text-muted">
                <span class="mr-1 inline-block rounded-full border border-white/70 bg-white/50 px-2 py-0.5 font-bold tabular-nums">
                  {{ formatPhone(c.phone) }}
                </span>
                {{ c.goodsCount }} тов. · {{ formatWeight(c.totalWeight) }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p
                class="text-sm font-extrabold tabular-nums"
                :class="c.unpaidRevenue > 0 ? 'text-danger' : 'text-success'"
              >
                {{ c.unpaidRevenue > 0 ? formatPrice(c.unpaidRevenue) : 'ок' }}
              </p>
              <p v-if="c.unpaidCount" class="text-[10px] font-bold text-muted">
                {{ c.unpaidCount }} неопл.
              </p>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
