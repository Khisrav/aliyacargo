<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

const availableLocales = computed(() =>
  locales.value.map(item => typeof item === 'string'
    ? { code: item, name: item }
    : { code: item.code, name: item.name ?? item.code }),
)

async function switchLocale(code: string) {
  if (code === locale.value) return
  await setLocale(code as 'ru' | 'tg' | 'uz')
}
</script>

<template>
  <div class="guest-layout">
    <header class="topbar">
      <span class="brand">Aliya Cargo</span>
      <div class="lang-switch" role="group" aria-label="Language">
        <button
          v-for="item in availableLocales"
          :key="item.code"
          type="button"
          class="lang-btn"
          :class="{ active: locale === item.code }"
          :aria-pressed="locale === item.code"
          @click="switchLocale(item.code)"
        >
          {{ item.code.toUpperCase() }}
        </button>
      </div>
    </header>
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.guest-layout {
  min-height: 100dvh;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  padding-top: calc(14px + env(safe-area-inset-top, 0px));
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.brand {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.lang-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--tg-theme-bg-color, #f0f0f0);
}

.lang-btn {
  min-width: 40px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--tg-theme-hint-color, #666);
  background: transparent;
}

.lang-btn.active {
  color: var(--tg-theme-button-text-color, #fff);
  background: var(--tg-theme-button-color, #3390ec);
}

.content {
  min-height: calc(100dvh - 64px);
}
</style>
