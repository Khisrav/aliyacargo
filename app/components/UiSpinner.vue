<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div class="flex min-h-[36dvh] flex-col items-center justify-center gap-3 px-6 text-center">
    <div class="h-9 w-9 rounded-full border-[3px] border-line border-t-brand animate-spin" />
    <p class="text-sm font-medium text-muted">{{ message || 'Загрузка…' }}</p>
  </div>
</template>
