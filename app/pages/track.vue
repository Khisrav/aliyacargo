<script setup lang="ts">
import { formatPhone, isValidPhone, normalizePhone } from '#shared/utils/phone'
import { normalizeTrackCode } from '#shared/utils/tracks'

definePageMeta({
  layout: 'guest',
})

interface LookupGood {
  weight: number
  price: number
  has_paid: boolean
  created_at: string
}

interface TrackHit {
  found: true
  code: string
  weight: number
  price: number
  has_paid: boolean
  created_at: string
  paid_at: string | null
}

interface TrackMiss {
  found: false
  code: string
}

interface LookupResult {
  found: boolean
  phone: string
  displayPhone: string
  client: { name: string, phone: string } | null
  goods: LookupGood[]
  stats: {
    totalCount: number
    totalWeight: number
    totalRevenue: number
    unpaidCount: number
    unpaidRevenue: number
    paidCount: number
    paidRevenue: number
  }
}

const { t, locale } = useI18n()

const mode = ref<'phone' | 'code'>('phone')
const phone = ref('')
const code = ref('')
const loading = ref(false)
const searched = ref(false)
const trackSearched = ref(false)
const errorMessage = ref('')
const result = ref<LookupResult | null>(null)
const trackResult = ref<TrackHit | TrackMiss | null>(null)
const phoneField = ref<{ focus: () => void } | null>(null)
const codeField = ref<HTMLInputElement | null>(null)

const phoneDigits = computed(() => normalizePhone(phone.value))
const trackCode = computed(() => normalizeTrackCode(code.value))
const canSearch = computed(() => isValidPhone(phoneDigits.value) && !loading.value)
const canSearchCode = computed(() => Boolean(trackCode.value) && !loading.value)
const canSubmit = computed(() => mode.value === 'phone' ? canSearch.value : canSearchCode.value)

const numberLocale = computed(() => {
  if (locale.value === 'uz') return 'uz-UZ'
  if (locale.value === 'tg') return 'tg-TJ'
  return 'ru-RU'
})

const formatters = computed(() => useFormatters(numberLocale.value))

onMounted(() => {
  nextTick(() => phoneField.value?.focus())
})

function setMode(next: 'phone' | 'code') {
  if (loading.value || mode.value === next) return
  mode.value = next
  errorMessage.value = ''
  nextTick(() => {
    if (next === 'code') codeField.value?.focus()
    else phoneField.value?.focus()
  })
}

function onPhoneInput(e: Event) {
  const input = e.target as HTMLInputElement
  const digits = normalizePhone(input.value)
  phone.value = formatPhone(digits)
  input.value = phone.value
}

async function lookupCode() {
  if (!canSearchCode.value || !trackCode.value) return

  loading.value = true
  errorMessage.value = ''
  trackSearched.value = true
  trackResult.value = null

  try {
    const res = await fetch('/api/public/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trackCode.value }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.statusMessage || t('track.lookupFailed'))
    }

    trackResult.value = data as TrackHit | TrackMiss
  }
  catch (e) {
    trackResult.value = null
    errorMessage.value = e instanceof Error ? e.message : t('track.requestError')
  }
  finally {
    loading.value = false
  }
}

function submit() {
  if (mode.value === 'code') void lookupCode()
  else void lookup()
}

async function lookup() {
  if (!canSearch.value) return

  loading.value = true
  errorMessage.value = ''
  searched.value = true

  try {
    const res = await fetch('/api/public/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneDigits.value }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.statusMessage || t('track.lookupFailed'))
    }

    result.value = data as LookupResult
  }
  catch (e) {
    result.value = null
    errorMessage.value = e instanceof Error ? e.message : t('track.requestError')
  }
  finally {
    loading.value = false
  }
}

const statItems = computed(() => {
  if (!result.value?.found) return []
  const f = formatters.value
  const s = result.value.stats
  return [
    { label: t('track.records'), value: s.totalCount },
    { label: t('track.weight'), value: f.formatWeight(s.totalWeight, t('track.kg')) },
    { label: t('track.amount'), value: f.formatPrice(s.totalRevenue) },
    { label: t('track.toPay'), value: f.formatPrice(s.unpaidRevenue), tone: 'danger' as const },
  ]
})
</script>

<template>
  <div class="animate-fade-up">
    <header class="px-5 pb-3 pt-2">
      <h1 class="text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">{{ $t('track.title') }}</h1>
      <p class="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-muted">{{ $t('track.subtitle') }}</p>
    </header>

    <main class="animate-fade-up space-y-4 px-4 pb-8">
      <section class="ui-card space-y-4 p-5">
        <div class="ui-glass flex rounded-full p-1">
          <button
            type="button"
            class="flex-1 rounded-full py-2 text-xs font-extrabold transition"
            :class="mode === 'phone' ? 'bg-brand text-white shadow' : 'text-muted'"
            @click="setMode('phone')"
          >
            {{ $t('track.byPhone') }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-full py-2 text-xs font-extrabold transition"
            :class="mode === 'code' ? 'bg-brand text-white shadow' : 'text-muted'"
            @click="setMode('code')"
          >
            {{ $t('track.byCode') }}
          </button>
        </div>

        <UiPhoneField
          v-if="mode === 'phone'"
          ref="phoneField"
          :model-value="phone"
          :label="$t('track.phone')"
          :hint="$t('track.phoneHint')"
          @input="onPhoneInput"
          @enter="lookup"
        />
        <label v-else class="ui-field">
          <span class="ui-label">{{ $t('track.trackNumber') }}</span>
          <input
            ref="codeField"
            v-model="code"
            type="text"
            class="ui-input font-mono tracking-wide"
            :placeholder="$t('track.trackPlaceholder')"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="search"
            maxlength="120"
            @keydown.enter.prevent="lookupCode"
          >
        </label>
        <button
          type="button"
          class="ui-btn-primary w-full"
          :class="{ 'opacity-100': canSubmit, 'opacity-40': !canSubmit }"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ loading ? $t('track.searching') : $t('track.search') }}
        </button>
      </section>

      <p v-if="errorMessage" class="text-center text-sm font-bold text-danger">{{ errorMessage }}</p>

      <template v-if="mode === 'code' && trackSearched && trackResult && !errorMessage">
        <section v-if="!trackResult.found" class="ui-card px-5 py-8 text-center">
          <p class="break-all text-sm font-medium text-muted">{{ $t('track.codeNotFound', { code: trackResult.code }) }}</p>
        </section>

        <section v-else class="ui-card overflow-hidden">
          <div
            class="flex items-center gap-3 px-5 py-4"
            :class="trackResult.has_paid ? 'bg-emerald-50/80' : 'bg-white/35'"
          >
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              :class="trackResult.has_paid
                ? 'bg-gradient-to-br from-emerald-300 to-success text-white'
                : 'border border-white/80 bg-white/70 text-muted'"
            >
              <svg v-if="trackResult.has_paid" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
              </svg>
            </span>
            <div class="min-w-0">
              <p class="text-lg font-semibold" :class="trackResult.has_paid ? 'text-emerald-800' : 'text-ink'">
                {{ trackResult.has_paid ? $t('track.paid') : $t('track.unpaid') }}
              </p>
              <p class="mt-0.5 break-all font-mono text-xs text-muted">{{ trackResult.code }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 px-5 py-4">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wide text-muted">{{ $t('track.weight') }}</p>
              <p class="mt-1 text-xl font-normal tabular-nums text-teal-700/80">
                {{ formatters.formatWeight(trackResult.weight, $t('track.kg')) }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wide text-muted">{{ $t('track.amount') }}</p>
              <p class="mt-1 text-xl font-normal tabular-nums text-amber-700/80">
                {{ formatters.formatPrice(trackResult.price) }}
              </p>
            </div>
          </div>

          <div class="space-y-3 border-t border-white/70 px-5 py-4">
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm text-muted">{{ $t('track.created') }}</span>
              <span class="text-sm font-normal tabular-nums text-sky-700/80">
                {{ formatters.formatDateTime(trackResult.created_at) }}
              </span>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm text-muted">{{ $t('track.paidOn') }}</span>
              <span
                class="text-sm font-normal tabular-nums"
                :class="trackResult.paid_at ? 'text-sky-700/80' : 'text-slate-400'"
              >
                {{ trackResult.paid_at ? formatters.formatDateTime(trackResult.paid_at) : '—' }}
              </span>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="mode === 'phone' && searched && result && !errorMessage">
        <section v-if="!result.found" class="ui-card px-5 py-8 text-center">
          <p class="text-sm font-medium text-muted">{{ $t('track.notFound', { phone: result.displayPhone }) }}</p>
        </section>

        <template v-else>
          <section class="ui-card px-5 py-5">
            <h2 class="text-xl font-extrabold text-ink">{{ result.client?.name }}</h2>
            <p class="mt-1 text-sm font-bold tabular-nums text-brand">+992 {{ result.displayPhone }}</p>
          </section>

          <UiStatGrid :items="statItems" />

          <section class="space-y-2.5">
            <h3 class="px-1 text-sm font-bold text-ink">{{ $t('track.history') }}</h3>
            <ul v-if="result.goods.length" class="space-y-2">
              <GoodsRow
                v-for="(item, index) in result.goods"
                :key="`${item.created_at}-${index}`"
                :weight="formatters.formatWeight(item.weight, $t('track.kg'))"
                :price="formatters.formatPrice(item.price)"
                :when="formatters.formatDateTime(item.created_at)"
                :has-paid="item.has_paid"
                :paid-label="$t('track.paid')"
                :unpaid-label="$t('track.unpaid')"
                readonly
                :show-trash="false"
              />
            </ul>
            <UiEmpty v-else :message="$t('track.noItems')" />
          </section>
        </template>
      </template>

      <p class="px-1 pt-2 text-center text-xs font-medium text-muted">
        {{ $t('track.viewOnly') }}
      </p>
    </main>
  </div>
</template>
