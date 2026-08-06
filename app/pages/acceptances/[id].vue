<script setup lang="ts">
import type { Acceptance, Good } from '#shared/types/domain'
import { formatPhone, isValidPhone, normalizePhone } from '#shared/utils/phone'

const route = useRoute()
const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { confirm } = useConfirm()
const { formatPrice, formatWeight, formatDateTime, formatDate } = useFormatters()
const { setTabBarHidden } = useTabBar()

const id = computed(() => Number(route.params.id))
const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const acceptance = ref<Acceptance | null>(null)
const goods = ref<Good[]>([])
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)

const pricePerKg = ref(30)
const phone = ref('')
const name = ref('')
const weight = ref('')
const nameLocked = ref(false)
const lookingUp = ref(false)
const submitting = ref(false)
const closing = ref(false)
const editOpen = ref(false)
const editing = ref<Good | null>(null)
const editName = ref('')
const editWeight = ref('')
const editSaving = ref(false)

const phoneField = ref<{ focus: () => void } | null>(null)
const nameRef = ref<HTMLInputElement>()
const weightRef = ref<HTMLInputElement>()
let phoneLookupToken = 0
let blurHideTimer: ReturnType<typeof setTimeout> | undefined

const phoneDigits = computed(() => normalizePhone(phone.value))
const weightNum = computed(() => parseFloat(weight.value.replace(',', '.')) || 0)
const calculatedPrice = computed(() => Math.round(weightNum.value * pricePerKg.value * 100) / 100)
const remaining = computed(() => {
  if (!acceptance.value) return 0
  return Math.max(0, acceptance.value.total_weight - (acceptance.value.sorted_weight ?? 0))
})
const canSubmit = computed(() =>
  acceptance.value?.status === 'open'
  && isValidPhone(phoneDigits.value)
  && name.value.trim().length > 0
  && weightNum.value > 0
  && !submitting.value,
)

watch(ready, async () => {
  if (!ready.value) return
  if (!(await requireWorker())) return
  try {
    const auth = await apiFetch<{ pricePerKg: number }>('/api/auth/check', { method: 'POST' })
    pricePerKg.value = auth.pricePerKg
  }
  catch { /* use default */ }
  await load()
}, { immediate: true })

function onFieldFocus() {
  if (blurHideTimer) clearTimeout(blurHideTimer)
  setTabBarHidden(true)
}

function onFieldBlur() {
  if (blurHideTimer) clearTimeout(blurHideTimer)
  blurHideTimer = setTimeout(() => {
    const active = document.activeElement as HTMLElement | null
    if (active?.closest('[data-sort-form]')) return
    setTabBarHidden(false)
  }, 120)
}

onUnmounted(() => {
  if (blurHideTimer) clearTimeout(blurHideTimer)
  setTabBarHidden(false)
})

async function load() {
  state.value = state.value === 'ok' ? 'ok' : 'loading'
  try {
    const res = await apiFetch<{ acceptance: Acceptance, goods: Good[] }>(`/api/acceptances/${id.value}`)
    acceptance.value = res.acceptance
    goods.value = res.goods
    state.value = 'ok'
    if (res.acceptance.status === 'open') {
      nextTick(() => phoneField.value?.focus())
    }
  }
  catch (e) {
    state.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Не удалось загрузить'
  }
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

async function lookupClient() {
  if (!isValidPhone(phoneDigits.value)) return
  const token = ++phoneLookupToken
  lookingUp.value = true
  try {
    const client = await apiFetch<{ id: number, name: string, phone: string } | null>(
      `/api/clients/by-phone/${phoneDigits.value}`,
    )
    if (token !== phoneLookupToken) return
    if (client?.name) {
      name.value = client.name
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
  if (digits.length === 9) lookupClient()
}

function onWeightInput(e: Event) {
  const input = e.target as HTMLInputElement
  let val = input.value.replace(',', '.').replace(/[^\d.]/g, '')
  const parts = val.split('.')
  if (parts.length > 2) val = `${parts[0]}.${parts.slice(1).join('')}`
  if (/^0\d/.test(val) && !val.includes('.')) val = `0.${val.slice(1)}`
  weight.value = val
  input.value = val
}

function resetForm() {
  phone.value = ''
  name.value = ''
  weight.value = ''
  nameLocked.value = false
  nextTick(() => phoneField.value?.focus())
}

async function submit() {
  if (!canSubmit.value || !acceptance.value) return
  submitting.value = true
  try {
    const item = await apiFetch<Good>('/api/goods', {
      method: 'POST',
      body: JSON.stringify({
        acceptance_id: acceptance.value.id,
        phone: phoneDigits.value,
        name: name.value.trim(),
        weight: weightNum.value,
      }),
    })
    goods.value.unshift(item)
    acceptance.value = {
      ...acceptance.value,
      sorted_weight: Math.round(((acceptance.value.sorted_weight ?? 0) + item.weight) * 1000) / 1000,
      goods_count: (acceptance.value.goods_count ?? 0) + 1,
    }
    showToast('success', `Сохранено · ${item.client_name || item.name} · ${formatPrice(item.price)}`)
    resetForm()
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось сохранить')
  }
  finally {
    submitting.value = false
  }
}

async function togglePaid(item: Good) {
  try {
    const updated = await apiFetch<Good>(`/api/goods/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_paid: !item.has_paid }),
    })
    const idx = goods.value.findIndex(g => g.id === item.id)
    if (idx !== -1) goods.value[idx] = updated
    haptic('light')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось обновить')
  }
}

async function removeGood(item: Good) {
  const ok = await confirm({
    title: 'Удалить товар?',
    message: `«${item.client_name || item.name}» будет перемещён в корзину.`,
    confirmLabel: 'В корзину',
    danger: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/trash/goods/${item.id}`, { method: 'DELETE' })
    goods.value = goods.value.filter(g => g.id !== item.id)
    if (acceptance.value) {
      acceptance.value = {
        ...acceptance.value,
        sorted_weight: Math.max(0, Math.round(((acceptance.value.sorted_weight ?? 0) - item.weight) * 1000) / 1000),
        goods_count: Math.max(0, (acceptance.value.goods_count ?? 0) - 1),
      }
    }
    showToast('success', 'Перемещено в корзину')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось удалить')
  }
}

function openEdit(item: Good) {
  if (acceptance.value?.status !== 'open') return
  editing.value = item
  editName.value = item.name || item.client_name
  editWeight.value = String(item.weight)
  editOpen.value = true
}

const editWeightNum = computed(() => parseFloat(editWeight.value.replace(',', '.')) || 0)
const editPrice = computed(() => Math.round(editWeightNum.value * pricePerKg.value * 100) / 100)
const canSaveEdit = computed(() =>
  !!editing.value
  && editName.value.trim().length > 0
  && editWeightNum.value > 0
  && !editSaving.value,
)

async function saveEdit() {
  if (!canSaveEdit.value || !editing.value || !acceptance.value) return
  editSaving.value = true
  try {
    const updated = await apiFetch<Good>(`/api/goods/${editing.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editName.value.trim(),
        weight: editWeightNum.value,
      }),
    })
    const idx = goods.value.findIndex(g => g.id === updated.id)
    const prev = idx !== -1 ? goods.value[idx] : null
    if (idx !== -1) goods.value[idx] = updated
    if (prev) {
      const delta = updated.weight - prev.weight
      acceptance.value = {
        ...acceptance.value,
        sorted_weight: Math.round(((acceptance.value.sorted_weight ?? 0) + delta) * 1000) / 1000,
      }
    }
    editOpen.value = false
    editing.value = null
    showToast('success', 'Сохранено')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось сохранить')
  }
  finally {
    editSaving.value = false
  }
}

async function closeAcceptance() {
  if (!acceptance.value || acceptance.value.status !== 'open') return
  const sorted = acceptance.value.sorted_weight ?? 0
  const waste = Math.max(0, acceptance.value.total_weight - sorted)
  const noGoods = (acceptance.value.goods_count ?? 0) === 0

  const ok = await confirm({
    title: 'Закрыть приёмку?',
    message: noGoods
      ? `Товаров нет. Весь вес ${formatWeight(acceptance.value.total_weight)} станет мусором (расход бизнеса). Добавить товары будет нельзя.`
      : `Отсортировано ${formatWeight(sorted)}. Мусор: ${formatWeight(waste)}. После закрытия добавлять товары нельзя.`,
    confirmLabel: 'Закрыть',
    danger: true,
  })
  if (!ok) return

  closing.value = true
  try {
    const updated = await apiFetch<Acceptance>(`/api/acceptances/${acceptance.value.id}`, {
      method: 'POST',
      body: JSON.stringify({ confirm: noGoods }),
    })
    acceptance.value = updated
    showToast('success', `Закрыто · мусор ${formatWeight(updated.waste_weight ?? 0)}`)
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось закрыть')
  }
  finally {
    closing.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="acceptance ? formatDate(acceptance.accepted_at) : 'Приёмка'"
      back-to="/acceptances"
      :show-refresh="acceptance?.status === 'closed'"
      :refreshing="state === 'loading'"
      @refresh="load"
    >
      <template v-if="acceptance?.status === 'open'" #actions>
        <button
          type="button"
          class="ui-icon-btn border border-rose-200 bg-danger-soft text-danger disabled:opacity-50"
          :disabled="closing"
          aria-label="Закрыть приёмку"
          @click="closeAcceptance"
        >
          <svg
            v-if="!closing"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <svg
            v-else
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            class="animate-spin"
          >
            <path d="M21 12a9 9 0 1 1-2.6-6.3" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </template>
    </PageHeader>

    <UiSpinner v-if="state === 'loading'" />
    <UiError v-else-if="state === 'error'" :message="errorMessage" @retry="load" />

    <main v-else-if="acceptance" class="space-y-4 px-4 pb-8">
      <div class="ui-card space-y-2 px-4 py-4 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-muted">Статус</span>
          <span
            class="rounded-full px-3 py-1 text-[11px] font-extrabold"
            :class="acceptance.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'"
          >
            {{ acceptance.status === 'open' ? 'Открыта · сортировка' : 'Закрыта' }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Принято</span>
          <span class="font-extrabold tabular-nums">{{ formatWeight(acceptance.total_weight) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Отсортировано</span>
          <span class="font-extrabold tabular-nums">{{ formatWeight(acceptance.sorted_weight ?? 0) }}</span>
        </div>
        <div v-if="acceptance.status === 'open'" class="flex justify-between">
          <span class="text-muted">Осталось</span>
          <span class="font-extrabold tabular-nums text-brand">{{ formatWeight(remaining) }}</span>
        </div>
        <div v-else class="flex justify-between">
          <span class="text-muted">Мусор</span>
          <span class="font-extrabold tabular-nums text-danger">{{ formatWeight(acceptance.waste_weight ?? 0) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Посреднику</span>
          <span class="font-extrabold tabular-nums">{{ formatPrice(acceptance.paid_tjs) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">Себест. / кг</span>
          <span class="font-extrabold tabular-nums">{{ formatPrice(acceptance.cost_per_kg) }}</span>
        </div>
      </div>

      <section v-if="acceptance.status === 'open'" data-sort-form class="ui-card space-y-4 p-5">
        <h2 class="text-sm font-extrabold text-ink">Сортировка</h2>
        <UiPhoneField
          ref="phoneField"
          :model-value="phone"
          label="Телефон"
          hint="без +992"
          :looking-up="lookingUp"
          :found="nameLocked"
          @input="onPhoneInput"
          @enter="lookupClient"
          @focus="onFieldFocus"
          @blur="lookupClient(); onFieldBlur()"
        />
        <label class="ui-field">
          <span class="ui-label">Имя клиента</span>
          <input
            ref="nameRef"
            v-model="name"
            type="text"
            autocomplete="off"
            class="ui-input"
            :readonly="nameLocked"
            @focus="onFieldFocus"
            @blur="onFieldBlur"
            @keydown.enter.prevent="weightRef?.focus()"
          >
        </label>
        <label class="ui-field">
          <span class="ui-label">Вес (кг)</span>
          <input
            ref="weightRef"
            :value="weight"
            type="text"
            inputmode="decimal"
            class="ui-input text-center text-[28px] font-extrabold tabular-nums"
            @focus="onFieldFocus"
            @blur="onFieldBlur"
            @input="onWeightInput"
            @keydown.enter.prevent="submit"
          >
        </label>
        <div class="flex items-center justify-between rounded-[1.25rem] bg-brand-soft/70 px-4 py-3">
          <span class="text-sm font-bold text-brand-dark/70">Цена клиенту</span>
          <span class="text-xl font-extrabold tabular-nums text-brand-dark">{{ formatPrice(calculatedPrice) }}</span>
        </div>
        <button type="button" class="ui-btn-primary w-full" :disabled="!canSubmit" @click="submit">
          {{ submitting ? 'Сохранение…' : 'Добавить товар' }}
        </button>
      </section>

      <section class="space-y-2.5">
        <h2 class="px-1 text-sm font-bold text-ink">
          Товары
          <span class="font-medium text-muted">{{ goods.length }}</span>
        </h2>
        <UiEmpty v-if="!goods.length" title="Пока пусто" description="Взвесьте первый товар клиента" />
        <ul v-else class="space-y-2">
          <GoodsRow
            v-for="item in goods"
            :key="item.id"
            :name="item.client_name || item.name"
            :phone="item.phone"
            :meta="`${formatWeight(item.weight)} · ${formatPrice(item.price)} · ${formatDateTime(item.created_at)}`"
            :has-paid="item.has_paid"
            :initiator="item.payment_accepted_by"
            :show-edit="acceptance.status === 'open'"
            :show-trash="acceptance.status === 'open'"
            @toggle-paid="togglePaid(item)"
            @edit="openEdit(item)"
            @remove="removeGood(item)"
          />
        </ul>
      </section>
    </main>

    <UiSheet v-model="editOpen">
      <div class="space-y-4 pt-1">
        <h2 class="text-xl font-extrabold text-ink">Изменить товар</h2>
        <label class="ui-field">
          <span class="ui-label">Название / имя</span>
          <input v-model="editName" type="text" class="ui-input" autocomplete="off">
        </label>
        <label class="ui-field">
          <span class="ui-label">Вес (кг)</span>
          <input
            v-model="editWeight"
            type="text"
            inputmode="decimal"
            class="ui-input text-center text-2xl font-extrabold tabular-nums"
          >
        </label>
        <div class="flex justify-between rounded-[1.25rem] bg-brand-soft/70 px-4 py-3 text-sm">
          <span class="font-bold text-brand-dark/70">Цена</span>
          <span class="font-extrabold tabular-nums text-brand-dark">{{ formatPrice(editPrice) }}</span>
        </div>
        <button type="button" class="ui-btn-primary w-full" :disabled="!canSaveEdit" @click="saveEdit">
          {{ editSaving ? 'Сохранение…' : 'Сохранить' }}
        </button>
      </div>
    </UiSheet>

    <UiToast :toast="toast" />
  </div>
</template>
