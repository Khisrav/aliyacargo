<script setup lang="ts">
import type { Good } from '#shared/types/domain'
import { normalizeTrackCode, trackCountLabel } from '#shared/utils/tracks'

const route = useRoute()
const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { setTabBarHidden } = useTabBar()
const { formatPrice, formatWeight, formatDateTime } = useFormatters()

const goodId = computed(() => Number(route.params.id))
const backTo = computed(() => {
  const raw = route.query.from
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) return value
  return '/warehouse'
})

const state = ref<'loading' | 'ok' | 'error'>('loading')
const loadError = ref('')
const good = ref<Good | null>(null)
const pending = ref<string[]>([])
const notice = ref('')
const errorMessage = ref('')
const saving = ref(false)
const scanRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const frame = ref({ top: 0, height: 0 })
const frameStyle = computed(() => {
  if (!frame.value.height) return { top: '0px', height: '100dvh' }
  return { top: `${frame.value.top}px`, height: `${frame.value.height}px` }
})

const savedCodes = computed(() => good.value?.tracks.map(track => track.code) ?? [])
const totalCount = computed(() => savedCodes.value.length + pending.value.length)
const canPay = computed(() => totalCount.value > 0 && !saving.value && !good.value?.has_paid)
const scanning = computed(() => state.value === 'ok' && good.value != null && !good.value.has_paid)

function syncFrame() {
  const viewport = window.visualViewport
  if (!viewport) {
    frame.value = { top: 0, height: window.innerHeight }
    return
  }
  frame.value = { top: viewport.offsetTop, height: viewport.height }
}

function focusScan() {
  nextTick(() => scanRef.value?.focus())
}

function scrollToLatest() {
  nextTick(() => {
    const el = listRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

function known(code: string) {
  return savedCodes.value.includes(code) || pending.value.includes(code)
}

function addCode(raw: string) {
  const code = normalizeTrackCode(raw)
  if (!code) return
  if (known(code)) {
    notice.value = 'Такой код уже есть'
    haptic('error')
    return
  }
  pending.value.push(code)
  notice.value = ''
  haptic('light')
  scrollToLatest()
}

function commit(el: HTMLInputElement) {
  const value = el.value
  el.value = ''
  addCode(value)
  focusScan()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  commit(event.target as HTMLInputElement)
}

function onInput(event: Event) {
  const el = event.target as HTMLInputElement
  if (!/[\r\n]/.test(el.value)) {
    if (notice.value) notice.value = ''
    return
  }
  commit(el)
}

function removePending(code: string) {
  pending.value = pending.value.filter(item => item !== code)
  notice.value = ''
  focusScan()
}

async function load() {
  state.value = good.value ? 'ok' : 'loading'
  try {
    good.value = await apiFetch<Good>(`/api/goods/${goodId.value}`)
    state.value = 'ok'
    if (!good.value.has_paid) focusScan()
    scrollToLatest()
  }
  catch (e) {
    state.value = 'error'
    loadError.value = e instanceof Error ? e.message : 'Не удалось загрузить'
  }
}

async function confirmPay() {
  if (!good.value || !canPay.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await apiFetch<Good>(`/api/goods/${good.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: true, tracks: pending.value }),
    })
    haptic('success')
    await navigateTo(backTo.value)
  }
  catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось сохранить'
    haptic('error')
    focusScan()
  }
  finally {
    saving.value = false
  }
}

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  await load()
}, { immediate: true })

watch(goodId, () => {
  if (ready.value) load()
})

onMounted(() => {
  setTabBarHidden(true)
  syncFrame()
  window.visualViewport?.addEventListener('resize', syncFrame)
  window.visualViewport?.addEventListener('scroll', syncFrame)
  setTimeout(() => setTabBarHidden(true), 0)
})

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', syncFrame)
  window.visualViewport?.removeEventListener('scroll', syncFrame)
  setTabBarHidden(false)
})
</script>

<template>
  <div
    class="fixed inset-x-0 z-[60] flex flex-col pt-[env(safe-area-inset-top,0px)]"
    :style="frameStyle"
  >
    <PageHeader
      :title="good?.client_name || good?.name || 'Выдача'"
      :back-to="backTo"
      show-refresh
      :refreshing="state === 'loading'"
      @refresh="load"
    >
      <template v-if="good" #subtitle>
        <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <UiFact icon="weight" :value="formatWeight(good.weight)" />
          <UiFact icon="price" :value="formatPrice(good.price)" />
          <UiFact v-if="totalCount" icon="box" :value="trackCountLabel(totalCount)" />
        </div>
        <div v-if="good.paid_at" class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <UiFact icon="date" :value="formatDateTime(good.paid_at)" />
          <UiFact v-if="good.payment_accepted_by" icon="user" :value="good.payment_accepted_by" />
        </div>
      </template>
    </PageHeader>

    <UiSpinner v-if="state === 'loading'" />
    <UiError v-else-if="state === 'error'" :message="loadError" @retry="load" />

    <div v-else-if="good" ref="listRef" class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      <p v-if="!totalCount" class="px-2 pt-8 text-center text-sm text-muted">
        {{ good.has_paid ? 'Треков нет' : 'Сканируйте товары. Коды появятся здесь.' }}
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="code in savedCodes"
          :key="`saved-${code}`"
          class="ui-card flex items-center gap-2 px-3 py-2.5"
        >
          <span class="min-w-0 flex-1 break-all font-mono text-[13px] font-bold text-ink">{{ code }}</span>
        </li>
        <li
          v-for="code in pending"
          :key="`new-${code}`"
          class="flex items-center gap-2 rounded-2xl border border-brand/20 bg-brand-soft/80 px-3 py-2.5"
        >
          <span class="min-w-0 flex-1 break-all font-mono text-[13px] font-bold text-ink">{{ code }}</span>
          <button
            type="button"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted"
            aria-label="Удалить код"
            :disabled="saving"
            @click="removePending(code)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </li>
      </ul>
    </div>

    <div
      v-if="scanning"
      class="shrink-0 border-t border-white/70 bg-white/80 px-4 pt-3 backdrop-blur-xl"
      :style="{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }"
    >
      <p v-if="notice" class="mb-2 text-sm font-bold text-danger">
        {{ notice }}
      </p>
      <p v-else-if="errorMessage" class="mb-2 text-sm font-bold text-danger">
        {{ errorMessage }}
      </p>
      <button
        type="button"
        class="ui-btn-primary mb-2 w-full"
        :disabled="!canPay"
        @click="confirmPay"
      >
        {{ saving ? 'Сохранение…' : 'Оплачено' }}
      </button>
      <input
        ref="scanRef"
        type="text"
        class="ui-input font-mono text-[15px] tracking-wide"
        placeholder="Трек-номер"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="done"
        maxlength="120"
        aria-label="Трек-номер"
        :disabled="saving"
        @keydown="onKeydown"
        @input="onInput"
      >
    </div>
  </div>
</template>
