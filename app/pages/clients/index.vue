<script setup lang="ts">
import type { ClientListItem } from '#shared/types/domain'
import { formatPhone, normalizePhone } from '#shared/utils/phone'

const { initData, ready, haptic } = useTelegram()
const { apiFetch } = useApi(initData)
const { requireWorker } = useWorkerGate()
const { confirm } = useConfirm()
const { formatPrice, formatWeight, formatNumber } = useFormatters()

const state = ref<'loading' | 'ok' | 'error'>('loading')
const errorMessage = ref('')
const clients = ref<ClientListItem[]>([])
const debtFilter = ref<'with_debt' | 'no_debt'>('with_debt')
const search = ref('')
const copying = ref(false)
const toast = ref<{ type: 'success' | 'error', message: string } | null>(null)

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

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { type, message }
  haptic(type)
  setTimeout(() => { toast.value = null }, 2500)
}

function phoneTail(phone: string) {
  return normalizePhone(phone).slice(-4)
}

function formatDebtRows(rows: ClientListItem[]) {
  return rows
    .map((item, index) => {
      const weight = formatNumber(item.unpaidWeight, 1)
      const debt = formatNumber(item.unpaidRevenue, 0)
      return `${index + 1}. ${item.name} — ${phoneTail(item.phone)} — ${weight} кг — ${debt} с.`
    })
    .join('\n')
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  }
  catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
}

async function copyDebtList() {
  if (copying.value) return
  copying.value = true
  try {
    let rows = clients.value
    if (debtFilter.value !== 'with_debt') {
      rows = await apiFetch<ClientListItem[]>('/api/clients?debt=with_debt')
    }
    rows = rows.filter(c => c.unpaidCount > 0)
    if (!rows.length) throw new Error('Нет клиентов с долгом')

    await copyToClipboard(formatDebtRows(rows))
    showToast('success', `Скопировано: ${rows.length}`)
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось скопировать')
  }
  finally {
    copying.value = false
  }
}

async function removeClient(client: ClientListItem, event: Event) {
  event.preventDefault()
  event.stopPropagation()
  const ok = await confirm({
    title: 'Удалить клиента?',
    message: `«${client.name}» и его товары будут перемещены в корзину.`,
    confirmLabel: 'В корзину',
    danger: true,
  })
  if (!ok) return
  try {
    await apiFetch(`/api/trash/clients/${client.id}`, { method: 'DELETE' })
    clients.value = clients.value.filter(c => c.id !== client.id)
    showToast('success', 'Перемещено в корзину')
  }
  catch (e) {
    showToast('error', e instanceof Error ? e.message : 'Не удалось удалить')
  }
}
</script>

<template>
  <div>
    <PageHeader title="Клиенты" show-refresh :refreshing="state === 'loading'" @refresh="load">
      <template #actions>
        <button
          type="button"
          class="ui-chip text-brand disabled:opacity-50"
          :disabled="copying || state !== 'ok'"
          @click="copyDebtList"
        >
          {{ copying ? '…' : 'Копировать' }}
        </button>
      </template>
    </PageHeader>

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
        <li v-for="c in clients" :key="c.id" class="relative">
          <NuxtLink :to="`/clients/${c.id}`" class="ui-card flex items-center gap-3 px-4 py-3.5 pr-14 transition active:scale-[0.99]">
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
          <button
            type="button"
            class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-danger-soft text-danger"
            aria-label="Удалить"
            @click="removeClient(c, $event)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </li>
      </ul>
    </div>

    <UiToast :toast="toast" />
  </div>
</template>
