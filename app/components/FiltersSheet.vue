<script setup lang="ts">
defineProps<{
  modelValue: boolean
  title?: string
  active?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
  clear: []
}>()
</script>

<template>
  <div class="flex items-center gap-2 px-5">
    <button
      type="button"
      class="ui-chip"
      :class="active ? 'ui-chip-active' : 'text-ink'"
      @click="$emit('update:modelValue', true)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
      </svg>
      {{ title || 'Фильтры' }}
      <span
        v-if="active"
        class="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
      >
        on
      </span>
    </button>
    <button
      v-if="active"
      type="button"
      class="ui-chip text-muted"
      @click="$emit('clear')"
    >
      Сбросить
    </button>
  </div>

  <UiSheet :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <div class="space-y-4">
      <h2 class="text-2xl font-extrabold tracking-tight text-ink">{{ title || 'Фильтры' }}</h2>
      <slot />
    </div>
  </UiSheet>
</template>
