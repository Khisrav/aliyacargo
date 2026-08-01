<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>

<template>
  <div class="px-6 py-10 text-center">
    <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-soft text-brand">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    </div>
    <p class="text-sm font-medium text-muted">{{ message }}</p>
  </div>
</template>
