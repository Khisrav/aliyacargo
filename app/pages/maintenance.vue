<script setup lang="ts">
definePageMeta({
  layout: 'guest',
})
</script>

<template>
  <div class="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
    <div class="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    </div>
    <div>
      <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand/80">
        Aliya Cargo
      </p>
      <h1 class="mt-2 text-2xl font-extrabold tracking-tight text-ink">
        Технические работы
      </h1>
      <p class="mt-2 max-w-xs text-sm font-medium text-muted">
        Приложение временно недоступно. Попробуйте позже.
      </p>
    </div>
  </div>
</template>
