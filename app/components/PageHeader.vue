<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  refreshing?: boolean
  showRefresh?: boolean
  backTo?: string
}>(), {
  showRefresh: false,
})

defineEmits<{
  refresh: []
}>()
</script>

<template>
  <header class="flex items-start justify-between gap-3 px-5 pb-3 pt-32">
    <div class="flex min-w-0 items-start gap-3">
      <NuxtLink
        v-if="backTo"
        :to="backTo"
        class="ui-icon-btn mt-1"
        aria-label="Назад"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </NuxtLink>
      <div class="min-w-0">
        <h1 class="truncate text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="mt-1.5 text-sm font-semibold text-muted">
          {{ subtitle }}
        </p>
        <slot name="subtitle" />
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-2 pt-1">
      <slot name="actions" />
      <button
        v-if="showRefresh"
        type="button"
        class="ui-icon-btn"
        aria-label="Обновить"
        :disabled="refreshing"
        @click="$emit('refresh')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="{ 'animate-spin': refreshing }"
        >
          <path d="M21 12a9 9 0 1 1-2.6-6.3" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </div>
  </header>
</template>
