<script setup lang="ts">
import { formatPhone, isValidPhone, normalizePhone } from '#shared/utils/phone'

definePageMeta({
  layout: 'guest',
})

interface LookupGood {
  weight: number
  price: number
  has_paid: boolean
  created_at: string
}

interface LookupResult {
  found: boolean
  phone: string
  displayPhone: string
  customer: { name: string, phone: string } | null
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

const phone = ref('')
const loading = ref(false)
const searched = ref(false)
const errorMessage = ref('')
const result = ref<LookupResult | null>(null)
const phoneField = ref<{ focus: () => void } | null>(null)

const phoneDigits = computed(() => normalizePhone(phone.value))
const canSearch = computed(() => isValidPhone(phoneDigits.value) && !loading.value)

const numberLocale = computed(() => {
  if (locale.value === 'uz') return 'uz-UZ'
  if (locale.value === 'tg') return 'tg-TJ'
  return 'ru-RU'
})

const formatters = computed(() => useFormatters(numberLocale.value))

onMounted(() => {
  nextTick(() => phoneField.value?.focus())
})

function onPhoneInput(e: Event) {
  const input = e.target as HTMLInputElement
  const digits = normalizePhone(input.value)
  phone.value = formatPhone(digits)
  input.value = phone.value
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
      <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand/80">Aliya Cargo</p>
      <h1 class="mt-1 text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">{{ $t('track.title') }}</h1>
      <p class="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-muted">{{ $t('track.subtitle') }}</p>
    </header>

    <main class="animate-fade-up space-y-4 px-4 pb-8">
      <section class="ui-card space-y-4 p-5">
        <UiPhoneField
          ref="phoneField"
          :model-value="phone"
          :label="$t('track.phone')"
          :hint="$t('track.phoneHint')"
          @input="onPhoneInput"
          @enter="lookup"
        />
        <button
          type="button"
          class="ui-btn-primary w-full"
          :class="{ 'opacity-100': canSearch, 'opacity-40': !canSearch }"
          :disabled="!canSearch"
          @click="lookup"
        >
          {{ loading ? $t('track.searching') : $t('track.search') }}
        </button>
      </section>

      <p v-if="errorMessage" class="text-center text-sm font-bold text-danger">{{ errorMessage }}</p>

      <template v-if="searched && result && !errorMessage">
        <section v-if="!result.found" class="ui-card px-5 py-8 text-center">
          <p class="text-sm font-medium text-muted">{{ $t('track.notFound', { phone: result.displayPhone }) }}</p>
        </section>

        <template v-else>
          <section class="ui-card px-5 py-5">
            <h2 class="text-xl font-extrabold text-ink">{{ result.customer?.name }}</h2>
            <p class="mt-1 text-sm font-bold tabular-nums text-brand">+992 {{ result.displayPhone }}</p>
          </section>

          <UiStatGrid :items="statItems" />

          <section class="space-y-2.5">
            <h3 class="px-1 text-sm font-bold text-ink">{{ $t('track.history') }}</h3>
            <ul v-if="result.goods.length" class="space-y-2">
              <GoodsRow
                v-for="(item, index) in result.goods"
                :key="`${item.created_at}-${index}`"
                :title="`${formatters.formatWeight(item.weight, $t('track.kg'))} · ${formatters.formatPrice(item.price)}`"
                :meta="formatters.formatDateTime(item.created_at)"
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
