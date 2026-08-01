<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

const localeLabels: Record<string, string> = {
  ru: 'RU',
  tg: 'TJ',
  uz: 'UZ',
}

const availableLocales = computed(() =>
  locales.value.map(item => typeof item === 'string'
    ? { code: item, label: localeLabels[item] ?? item.toUpperCase() }
    : { code: item.code, label: localeLabels[item.code] ?? item.code.toUpperCase() }),
)

async function switchLocale(code: string) {
  if (code === locale.value) return
  await setLocale(code as 'ru' | 'tg' | 'uz')
}
</script>

<template>
  <div class="app-mesh min-h-dvh">
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-end px-4"
      :style="{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }"
    >
      <div
        class="pointer-events-auto ui-glass-strong flex items-center gap-0.5 rounded-full p-1"
        role="group"
        aria-label="Language"
      >
        <button
          v-for="item in availableLocales"
          :key="item.code"
          type="button"
          class="min-w-[40px] rounded-full px-2.5 py-1.5 text-xs font-extrabold tracking-wide transition duration-200"
          :class="locale === item.code ? 'ui-chip-active' : 'text-muted'"
          :aria-pressed="locale === item.code"
          @click="switchLocale(item.code)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <main
      class="min-h-dvh pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
      :style="{ paddingTop: 'calc(3.25rem + env(safe-area-inset-top, 0px))' }"
    >
      <slot />
    </main>
  </div>
</template>
