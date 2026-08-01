<script setup lang="ts">
defineProps<{
  message?: string
  label?: string
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="flex min-h-[40dvh] flex-col items-center justify-center gap-3 px-6 text-center">
    <div class="flex h-14 w-14 items-center justify-center rounded-3xl bg-danger-soft text-danger">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    </div>
    <h2 class="text-lg font-extrabold text-ink">{{ label || 'Ошибка' }}</h2>
    <p v-if="message" class="max-w-xs text-sm text-muted">{{ message }}</p>
    <button type="button" class="ui-btn-primary mt-1 px-6" @click="$emit('retry')">
      Повторить
    </button>
  </div>
</template>
