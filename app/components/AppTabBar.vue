<script setup lang="ts">
const route = useRoute()
const moreOpen = ref(false)

const primary = [
  {
    to: '/',
    label: 'Весы',
    match: (path: string) => path === '/',
    icon: 'scale',
  },
  {
    to: '/goods',
    label: 'Записи',
    match: (path: string) => path.startsWith('/goods'),
    icon: 'box',
  },
  {
    to: '/clients',
    label: 'Клиенты',
    match: (path: string) => path.startsWith('/clients'),
    icon: 'users',
  },
] as const

const moreLinks = [
  { to: '/stats', label: 'Статистика', desc: 'KPI, долги, график', icon: 'chart' },
  { to: '/trash', label: 'Корзина', desc: 'Восстановление записей', icon: 'trash' },
] as const

const moreActive = computed(() =>
  route.path.startsWith('/stats') || route.path.startsWith('/trash'),
)

watch(() => route.fullPath, () => {
  moreOpen.value = false
})
</script>

<template>
  <nav
    class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3"
    :style="{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }"
  >
    <div class="pointer-events-auto ui-glass-strong mx-auto flex w-full max-w-md items-stretch gap-1 rounded-blob p-1.5 shadow-dock rounded-3xl">
      <NuxtLink
        v-for="item in primary"
        :key="item.to"
        :to="item.to"
        class="relative flex flex-1 flex-col items-center gap-0.5 rounded-[1.35rem] px-1 py-2 text-[10px] font-extrabold tracking-wide transition duration-200 ease-expressive"
        :class="item.match(route.path) ? 'text-brand' : 'text-muted'"
      >
        <span
          class="flex h-9 w-12 items-center justify-center rounded-full transition duration-300 ease-spring"
          :class="item.match(route.path)
            ? 'bg-gradient-to-br from-teal-300/90 to-brand text-white shadow-[0_8px_18px_rgba(13,148,136,0.35)]'
            : 'bg-transparent'"
        >
          <svg v-if="item.icon === 'scale'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v18" />
            <path d="M5 7h14l-2.5 8H7.5L5 7z" />
            <path d="M8 21h8" />
          </svg>
          <svg v-else-if="item.icon === 'box'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <path d="M3.3 7.5L12 12l8.7-4.5" />
            <path d="M12 12v9" />
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
            <circle cx="9.5" cy="7" r="3.5" />
            <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35" />
            <path d="M16.5 3.7a3.5 3.5 0 0 1 0 6.6" />
          </svg>
        </span>
        {{ item.label }}
      </NuxtLink>

      <button
        type="button"
        class="relative flex flex-1 flex-col items-center gap-0.5 rounded-[1.35rem] px-1 py-2 text-[10px] font-extrabold tracking-wide transition duration-200 ease-expressive"
        :class="moreActive || moreOpen ? 'text-brand' : 'text-muted'"
        @click="moreOpen = true"
      >
        <span
          class="flex h-9 w-12 items-center justify-center rounded-full transition duration-300 ease-spring"
          :class="moreActive || moreOpen
            ? 'bg-gradient-to-br from-amber-300 to-accent text-ink shadow-[0_8px_18px_rgba(245,158,11,0.35)]'
            : 'bg-transparent'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
            <circle cx="5" cy="12" r="1.7" fill="currentColor" />
            <circle cx="12" cy="12" r="1.7" fill="currentColor" />
            <circle cx="19" cy="12" r="1.7" fill="currentColor" />
          </svg>
        </span>
        Ещё
      </button>
    </div>
  </nav>

  <UiSheet v-model="moreOpen">
    <div class="space-y-3 pt-1">
      <div>
        <p class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">Aliya Cargo</p>
        <h2 class="mt-1 text-2xl font-extrabold tracking-tight text-ink">Ещё</h2>
      </div>
      <NuxtLink
        v-for="link in moreLinks"
        :key="link.to"
        :to="link.to"
        class="ui-glass flex items-center gap-3 rounded-[1.5rem] px-4 py-4 transition duration-200 active:scale-[0.98]"
        @click="moreOpen = false"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-2xl"
          :class="link.icon === 'chart'
            ? 'bg-gradient-to-br from-teal-300 to-brand text-white shadow-[0_8px_18px_rgba(13,148,136,0.28)]'
            : 'bg-gradient-to-br from-amber-200 to-accent text-ink shadow-[0_8px_18px_rgba(245,158,11,0.28)]'"
        >
          <svg v-if="link.icon === 'chart'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19V5" />
            <path d="M4 19h16" />
            <path d="M8 15v-4" />
            <path d="M12 15V8" />
            <path d="M16 15v-7" />
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="font-extrabold text-ink">{{ link.label }}</p>
          <p class="text-xs font-medium text-muted">{{ link.desc }}</p>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="text-muted">
          <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </NuxtLink>
    </div>
  </UiSheet>
</template>
