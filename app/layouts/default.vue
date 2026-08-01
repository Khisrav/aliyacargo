<template>
  <div class="app-mesh min-h-dvh">
    <main
      class="pb-tabbar min-h-dvh"
      :style="{ paddingTop: 'env(safe-area-inset-top, 0px)' }"
    >
      <slot />
    </main>

    <AppTabBar />
    <UiConfirmSheet />
  </div>
</template>
