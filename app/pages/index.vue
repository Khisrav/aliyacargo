<script setup lang="ts">
import type { Acceptance } from '#shared/types/domain'

const { initData, ready } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const router = useRouter()

const state = ref<'loading' | 'denied' | 'error'>('loading')
const errorMessage = ref('')

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) {
    state.value = 'denied'
    return
  }
  try {
    await apiFetch('/api/auth/check', { method: 'POST' })
    const active = await apiFetch<Acceptance | null>('/api/acceptances/active')
    if (active) {
      await router.replace(`/acceptances/${active.id}`)
    }
    else {
      await router.replace('/acceptances')
    }
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Ошибка'
  }
}, { immediate: true })
</script>

<template>
  <div>
    <UiSpinner v-if="state === 'loading'" />
    <UiError v-else-if="state === 'error'" :message="errorMessage" />
  </div>
</template>
