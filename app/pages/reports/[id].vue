<script setup lang="ts">
import type { Report } from '#shared/types/report'

const route = useRoute()
const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatDate } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const report = ref<Report | null>(null)

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(() => route.params.id, () => {
  if (ready.value) load()
})

async function load() {
  const id = Number(route.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    state.value = 'error'
    errorMessage.value = 'Некорректный отчёт'
    return
  }

  state.value = 'loading'
  try {
    report.value = await apiFetch<Report>(`/api/reports/${id}`)
    state.value = 'ok'
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить отчёт'
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="report ? formatDate(report.report_date) : 'Отчёт'"
      subtitle="Только просмотр"
      back-to="/reports"
      show-refresh
      :refreshing="state === 'loading'"
      @refresh="load"
    />

    <UiSpinner v-if="state === 'loading'" />
    <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />
    <main v-else-if="report" class="px-4 pb-6">
      <ReportView :report="report" />
    </main>
  </div>
</template>
