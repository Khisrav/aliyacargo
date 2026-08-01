<script setup lang="ts">
const { tabBarHidden } = useTabBar()
</script>

<template>
  <div class="app-mesh min-h-dvh">
    <main
      class="min-h-dvh transition-[padding] duration-200"
      :class="tabBarHidden ? 'pb-6' : 'pb-tabbar'"
      :style="{ paddingTop: 'env(safe-area-inset-top, 0px)' }"
    >
      <slot />
    </main>

    <AppTabBar />
    <UiConfirmSheet />
  </div>
</template>
