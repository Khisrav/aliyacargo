<script setup lang="ts">
import type { CustomerGood } from '~/composables/useTelegram'
import { formatPhone, isValidPhone, normalizePhone } from '#shared/utils/phone'

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { confirm } = useConfirm()
const { formatPrice, formatWeight, formatDateTime } = useFormatters()
const { setTabBarHidden } = useTabBar()

const authState = ref<'loading' | 'ok' | 'denied' | 'error'>('loading')
const authError = ref('')
const pricePerKg = ref(1000)
const userName = ref('')

const phone = ref('')
const name = ref('')
const weight = ref('')
const nameLocked = ref(false)
const lookingUp = ref(false)

const submitting = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)
const sessionGoods = ref<CustomerGood[]>([])

const phoneField = ref<{ focus: () => void } | null>(null)
const nameRef = ref<HTMLInputElement>()
const weightRef = ref<HTMLInputElement>()

let phoneLookupToken = 0
let blurHideTimer: ReturnType<typeof setTimeout> | undefined

function onFieldFocus() {
  if (blurHideTimer) {
    clearTimeout(blurHideTimer)
    blurHideTimer = undefined
  }
  setTabBarHidden(true)
}

function onFieldBlur() {
  if (blurHideTimer) clearTimeout(blurHideTimer)
  blurHideTimer = setTimeout(() => {
    const active = document.activeElement as HTMLElement | null
    if (active?.closest('[data-weigh-form]')) return
    setTabBarHidden(false)
  }, 120)
}

onUnmounted(() => {
  if (blurHideTimer) clearTimeout(blurHideTimer)
  setTabBarHidden(false)
})

const phoneDigits = computed(() => normalizePhone(phone.value))
const weightNum = computed(() => parseFloat(weight.value.replace(',', '.')) || 0)
const calculatedPrice = computed(() => Math.round(weightNum.value * pricePerKg.value * 100) / 100)

const canSubmit = computed(() =>
  isValidPhone(phoneDigits.value)
  && name.value.trim().length > 0
  && weightNum.value > 0
  && !submitting.value,
)

watch(ready, checkAuth, { immediate: true })

async function checkAuth() {
  if (!ready.value) return

  const allowed = await requireWorker()
  if (!allowed) return

  try {
    const res = await apiFetch<{ ok: boolean, pricePerKg: number, user: { first_name: string } }>(
      '/api/auth/check',
      { method: 'POST' },
    )
    pricePerKg.value = res.pricePerKg
    userName.value = res.user.first_name
    authState.value = 'ok'
    nextTick(() => phoneField.value?.focus())
  }
  catch (e) {
    authState.value = 'denied'
    authError.value = e instanceof Error ? e.message : 'Доступ запрещён'
  }
}

async function lookupCustomer() {
  if (!isValidPhone(phoneDigits.value)) return

  const token = ++phoneLookupToken
  lookingUp.value = true
  try {
    const customer = await apiFetch<{ id: number, name: string, phone: string } | null>(
      `/api/customers/${phoneDigits.value}`,
    )

    if (token !== phoneLookupToken) return

    if (customer?.name) {
      name.value = customer.name
      nameLocked.value = true
      nextTick(() => weightRef.value?.focus())
    }
    else {
      nameLocked.value = false
      if (!name.value) nextTick(() => nameRef.value?.focus())
    }
  }
  catch {
    if (token === phoneLookupToken) nameLocked.value = false
  }
  finally {
    if (token === phoneLookupToken) lookingUp.value = false
  }
}

function onPhoneInput(e: Event) {
  const input = e.target as HTMLInputElement
  const digits = normalizePhone(input.value)
  phone.value = formatPhone(digits)
  input.value = phone.value
  nameLocked.value = false

  if (digits.length === 9) {
    lookupCustomer()
  }
}

function onWeightInput(e: Event) {
  const input = e.target as HTMLInputElement
  let val = input.value.replace(',', '.').replace(/[^\d.]/g, '')
  const parts = val.split('.')
  if (parts.length > 2) val = `${parts[0]}.${parts.slice(1).join('')}`
  if (val.startsWith('0') && !val.includes('.')) val = `0.${val.slice(1)}`
  weight.value = val
  input.value = val
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

function resetForm() {
  phone.value = ''
  name.value = ''
  weight.value = ''
  nameLocked.value = false
  nextTick(() => phoneField.value?.focus())
}

async function submit() {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    const item = await apiFetch<CustomerGood>('/api/goods', {
      method: 'POST',
      body: JSON.stringify({
        phone: phoneDigits.value,
        name: name.value.trim(),
        weight: weightNum.value,
      }),
    })
    sessionGoods.value.unshift(item)
    showToast('success', `Сохранено · ${item.name} · ${formatPrice(item.price)}`)
    resetForm()
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось сохранить')
  }
  finally {
    submitting.value = false
  }
}

async function togglePaid(item: CustomerGood) {
  try {
    const updated = await apiFetch<CustomerGood>(`/api/goods/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: !item.has_paid }),
    })
    const idx = sessionGoods.value.findIndex(g => g.id === item.id)
    if (idx !== -1) sessionGoods.value[idx] = updated
    haptic('light')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось обновить')
  }
}

async function removeGood(item: CustomerGood) {
  const ok = await confirm({
    title: 'Удалить запись?',
    message: `«${item.name}» будет перемещена в корзину.`,
    confirmLabel: 'В корзину',
    danger: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/trash/goods/${item.id}`, { method: 'DELETE' })
    sessionGoods.value = sessionGoods.value.filter(g => g.id !== item.id)
    showToast('success', 'Перемещено в корзину')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось удалить')
  }
}

function onPhoneEnter() {
  if (isValidPhone(phoneDigits.value)) {
    lookupCustomer()
  }
}

function onPhoneBlur() {
  lookupCustomer()
  onFieldBlur()
}

function onNameEnter() {
  weightRef.value?.focus()
}

function onWeightEnter() {
  if (canSubmit.value) submit()
}
</script>

<template>
  <div>
    <UiSpinner v-if="authState === 'loading'" />

    <div v-else-if="authState === 'denied'" class="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-3xl bg-danger-soft text-danger">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <h1 class="text-xl font-extrabold text-ink">Доступ запрещён</h1>
      <p class="max-w-xs text-sm text-muted">{{ authError }}</p>
    </div>

    <template v-else>
      <PageHeader :title="'Взвешивание'" :subtitle="userName ? `Привет, ${userName}` : undefined">
        <template #actions>
          <NuxtLink to="/goods" class="ui-chip text-brand">
            Все записи
          </NuxtLink>
        </template>
      </PageHeader>

      <div class="animate-fade-up space-y-4 px-4 pb-8">
        <section data-weigh-form class="ui-card space-y-4 p-5">
          <UiPhoneField
            ref="phoneField"
            :model-value="phone"
            label="Телефон"
            hint="без +992"
            :looking-up="lookingUp"
            :found="nameLocked"
            @input="onPhoneInput"
            @enter="onPhoneEnter"
            @focus="onFieldFocus"
            @blur="onPhoneBlur"
          />

          <label class="ui-field">
            <span class="ui-label">Имя клиента</span>
            <input
              ref="nameRef"
              v-model="name"
              type="text"
              autocomplete="off"
              autocapitalize="words"
              enterkeyhint="next"
              placeholder="Полное имя"
              class="ui-input"
              @focus="onFieldFocus"
              @blur="onFieldBlur"
              @keydown.enter.prevent="onNameEnter"
            >
          </label>

          <label class="ui-field">
            <span class="ui-label">Вес (кг)</span>
            <input
              ref="weightRef"
              :value="weight"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              enterkeyhint="done"
              placeholder="0.0"
              class="ui-input text-center text-[28px] font-extrabold tabular-nums"
              @focus="onFieldFocus"
              @blur="onFieldBlur"
              @input="onWeightInput"
              @keydown.enter.prevent="onWeightEnter"
            >
          </label>

          <div
            class="flex items-center justify-between rounded-[1.25rem] border border-brand/10 bg-gradient-to-r from-brand-soft/80 to-teal-50/60 px-4 py-3.5 transition"
            :class="weightNum > 0 ? 'opacity-100' : 'opacity-45'"
          >
            <span class="text-sm font-bold text-brand-dark/70">Цена</span>
            <span class="text-xl font-extrabold tabular-nums text-brand-dark">{{ formatPrice(calculatedPrice) }}</span>
          </div>

          <button
            type="button"
            class="ui-btn-primary w-full"
            :class="{ 'opacity-100': canSubmit, 'opacity-40': !canSubmit }"
            :disabled="!canSubmit"
            @click="submit"
          >
            {{ submitting ? 'Сохранение…' : 'Сохранить и далее' }}
          </button>
        </section>

        <section v-if="sessionGoods.length" class="space-y-2.5">
          <h2 class="px-1 text-sm font-bold text-ink">
            В этой сессии
            <span class="font-medium text-muted">{{ sessionGoods.length }}</span>
          </h2>
          <ul class="space-y-2">
            <GoodsRow
              v-for="item in sessionGoods"
              :key="item.id"
              :name="item.name"
              :phone="item.phone"
              :meta="`${formatWeight(item.weight)} · ${formatPrice(item.price)} · ${formatDateTime(item.created_at)}`"
              :has-paid="item.has_paid"
              @toggle-paid="togglePaid(item)"
              @remove="removeGood(item)"
            />
          </ul>
        </section>

        <UiEmpty v-else message="Записей в этой сессии пока нет. Добавьте первую выше." />
      </div>

      <UiToast :toast="toast" />
    </template>
  </div>
</template>
