<template>
  <div class="guest-layout">
    <header class="topbar">
      <span class="brand">Aliya Cargo</span>
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

.content {
  min-height: calc(100dvh - 64px);
}
</style>
