<script setup lang="ts">
withDefaults(defineProps<{
  icon: 'weight' | 'price' | 'date' | 'phone' | 'box' | 'user'
  value: string | number
  emphasis?: boolean
}>(), {
  emphasis: false,
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1"
    :class="emphasis ? 'text-sm font-extrabold text-ink' : 'text-xs font-semibold text-muted'"
  >
    <svg
      class="shrink-0"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <template v-if="icon === 'weight'">
        <path d="M12 3v2" />
        <path d="M4 8h16" />
        <path d="M12 8v11" />
        <path d="M8 21h8" />
        <path d="M6 8 3.5 14h5L6 8Z" />
        <path d="M18 8l-2.5 6h5L18 8Z" />
      </template>
      <template v-else-if="icon === 'price'">
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v4c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        <path d="M5 11v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4" />
      </template>
      <template v-else-if="icon === 'date'">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
      </template>
      <template v-else-if="icon === 'phone'">
        <path d="M8 3h3l1.5 4-2 1a11 11 0 0 0 5 5l1-2 4 1.5V16a2 2 0 0 1-2 2A14 14 0 0 1 6 5a2 2 0 0 1 2-2Z" />
      </template>
      <template v-else-if="icon === 'box'">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="M3.3 7.5 12 12l8.7-4.5" />
        <path d="M12 12v9" />
      </template>
      <template v-else>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
      </template>
    </svg>
    <span class="tabular-nums">{{ value }}</span>
  </span>
</template>
