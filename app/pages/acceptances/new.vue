<script setup lang="ts">
import type { Acceptance } from '#shared/types/domain'

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { formatPrice } = useFormatters()
const router = useRouter()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const saving = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)

const acceptedAt = ref(new Date().toISOString().slice(0, 10))
const totalWeight = ref('')
const paidTjs = ref('')

function num(v: string) {
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

const weightNum = computed(() => num(totalWeight.value))
const paidNum = computed(() => num(paidTjs.value))
const costPerKg = computed(() => {
  if (!(weightNum.value > 0) || !Number.isFinite(paidNum.value)) return 0
  return Math.round((paidNum.value / weightNum.value) * 10000) / 10000
})

const canSave = computed(() => weightNum.value > 0 && Number.isFinite(paidNum.value) && paidNum.value >= 0 && !saving.value)

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  state.value = 'ok'
}, { immediate: true })

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    const created = await apiFetch<Acceptance>('/api/acceptances', {
      method: 'POST',
      body: JSON.stringify({
        accepted_at: acceptedAt.value,
        total_weight: weightNum.value,
        paid_tjs: paidNum.value,
      }),
    })
    showToast('success', 'Приёмка создана')
    await router.replace(`/acceptances/${created.id}`)
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
    <PageHeader title="Новая приёмка" subtitle="Груз с границы" back-to="/acceptances" />

    <UiSpinner v-if="state === 'loading'" />
    <main v-else class="space-y-4 px-4 pb-8">
      <p class="text-xs font-medium text-muted">
        Укажите общий вес партии и сколько заплатили посреднику. Себестоимость за кг рассчитается автоматически.
      </p>

      <label class="ui-field">
        <span class="ui-label">Дата приёмки</span>
        <input v-model="acceptedAt" type="date" class="ui-input">
      </label>

      <label class="ui-field">
        <span class="ui-label">Общий вес, кг</span>
        <input v-model="totalWeight" type="text" inputmode="decimal" class="ui-input" placeholder="Например 500">
      </label>

      <label class="ui-field">
        <span class="ui-label">Оплачено посреднику, TJS</span>
        <input v-model="paidTjs" type="text" inputmode="decimal" class="ui-input" placeholder="Например 5000">
      </label>

      <div class="ui-card space-y-2 px-4 py-3.5 text-sm">
        <div class="flex justify-between gap-3">
          <span class="text-muted">Себестоимость / кг</span>
          <span class="font-extrabold tabular-nums text-ink">{{ formatPrice(costPerKg) }}</span>
        </div>
      </div>

      <button
        type="button"
        class="ui-btn-primary w-full"
        :disabled="!canSave"
        @click="save"
      >
        {{ saving ? 'Сохранение…' : 'Создать и начать сортировку' }}
      </button>
    </main>

    <UiToast :toast="toast" />
  </div>
</template>
