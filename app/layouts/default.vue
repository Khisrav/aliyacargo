<script setup lang="ts">
const menuOpen = ref(false)
const route = useRoute()

const links = [
  { to: '/', label: 'Взвешивание', icon: '⚖️' },
  { to: '/goods', label: 'Записи', icon: '📦' },
  { to: '/clients', label: 'Клиенты', icon: '👥' },
  { to: '/stats', label: 'Статистика', icon: '📊' },
]

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

watch(() => route.fullPath, closeMenu)
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <button class="burger" aria-label="Открыть меню" @click="toggleMenu">
        <span />
        <span />
        <span />
      </button>
      <span class="brand">Aliya Cargo</span>
      <span class="spacer" />
    </header>

    <Transition name="fade">
      <div v-if="menuOpen" class="overlay" @click="closeMenu" />
    </Transition>

    <Transition name="drawer">
      <nav v-if="menuOpen" class="drawer">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="drawer-link"
          :class="{ active: link.to === '/' ? route.path === '/' : route.path.startsWith(link.to) }"
          @click="closeMenu"
        >
          <span class="drawer-icon">{{ link.icon }}</span>
          {{ link.label }}
        </NuxtLink>
      </nav>
    </Transition>

    <main class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100dvh;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  padding-top: calc(14px + env(safe-area-inset-top, 0px));
  background: var(--tg-theme-secondary-bg-color, #fff);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.burger {
  width: 36px;
  height: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 10px;
  flex-shrink: 0;
}

.burger:active {
  background: var(--tg-theme-bg-color, #f0f0f0);
}

.burger span {
  width: 18px;
  height: 2px;
  border-radius: 1px;
  background: var(--tg-theme-text-color, #1a1a1a);
}

.brand {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.spacer {
  flex: 1;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 60;
}

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 70;
  width: min(78vw, 280px);
  padding: calc(20px + env(safe-area-inset-top, 0px)) 12px 20px;
  background: var(--tg-theme-secondary-bg-color, #fff);
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
}

.drawer-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #1a1a1a);
}

.drawer-link.active {
  background: var(--tg-theme-bg-color, #f0f0f0);
  color: var(--tg-theme-button-color, #3390ec);
}

.drawer-icon {
  font-size: 18px;
}

.content {
  min-height: calc(100dvh - 64px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.25s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}
</style>
