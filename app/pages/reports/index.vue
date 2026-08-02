<script setup lang="ts">
import type { Report } from '#shared/types/report'

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice, formatDate } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const reports = ref<Report[]>([])
const todayExists = ref(false)
const todayId = ref<number | null>(null)

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

async function load() {
  if (!ready.value) return
  state.value = 'loading'
  try {
    const [list, preview] = await Promise.all([
      apiFetch<Report[]>('/api/reports'),
      apiFetch<{ todayExists: boolean, existingId: number | null }>('/api/reports/preview'),
    ])
    reports.value = list
    todayExists.value = preview.todayExists
    todayId.value = preview.existingId
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить отчёты'
  }
}
</script>

<template>
  <div>
    <PageHeader title="Отчёты" subtitle="Ежедневные сводки" show-refresh :refreshing="state === 'loading'" @refresh="load">
      <template #actions>
        <NuxtLink
          v-if="!todayExists"
          to="/reports/new"
          class="ui-chip text-brand"
        >
          Создать
        </NuxtLink>
        <NuxtLink
          v-else-if="todayId"
          :to="`/reports/${todayId}`"
          class="ui-chip text-muted"
        >
          Сегодня
        </NuxtLink>
      </template>
    </PageHeader>

    <UiSpinner v-if="state === 'loading'" />
    <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

    <main v-else class="space-y-3 px-4 pb-6">
      <p v-if="!todayExists" class="ui-card px-4 py-3 text-sm text-muted">
        Отчёт за сегодня ещё не создан. Данные подставятся автоматически — их можно поправить перед сохранением. После сохранения изменить нельзя.
      </p>
      <p v-else class="ui-card px-4 py-3 text-sm text-muted">
        Отчёт за сегодня уже сохранён и зафиксирован.
      </p>

      <div v-if="reports.length" class="space-y-2">
        <NuxtLink
          v-for="item in reports"
          :key="item.id"
          :to="`/reports/${item.id}`"
          class="ui-card flex items-center gap-3 px-4 py-3.5 transition active:scale-[0.99]"
        >
          <div class="min-w-0 flex-1">
            <p class="font-extrabold text-ink">{{ formatDate(item.report_date) }}</p>
            <p class="mt-0.5 text-xs text-muted">
              {{ item.goods_count }} зап. · {{ item.unpaid_count }} остатков · {{ formatPrice(item.net_profit) }}
            </p>
          </div>
          <span
            class="text-sm font-extrabold tabular-nums"
            :class="item.net_profit >= 0 ? 'text-brand' : 'text-danger'"
          >
            {{ formatPrice(item.net_profit) }}
          </span>
        </NuxtLink>
      </div>
      <p v-else class="py-10 text-center text-sm text-muted">Пока нет отчётов</p>
    </main>
  </div>
</template>
