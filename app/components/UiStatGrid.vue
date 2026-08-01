<script setup lang="ts">
export interface StatItem {
  label: string
  value: string | number
  tone?: 'default' | 'accent' | 'danger'
}

defineProps<{
  items: StatItem[]
}>()
</script>

<template>
  <section class="grid grid-cols-2 gap-3">
    <div
      v-for="(item, i) in items"
      :key="`${item.label}-${i}`"
      class="relative overflow-hidden rounded-[1.5rem] border border-white/70 px-3.5 py-4 shadow-app backdrop-blur-xl"
      :class="{
        'bg-gradient-to-br from-amber-100/90 to-orange-50/80': item.tone === 'accent',
        'bg-gradient-to-br from-rose-100/90 to-red-50/80': item.tone === 'danger',
        'bg-white/55': !item.tone || item.tone === 'default',
      }"
    >
      <div
        class="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-40 blur-2xl"
        :class="{
          'bg-accent': item.tone === 'accent',
          'bg-danger': item.tone === 'danger',
          'bg-brand': !item.tone || item.tone === 'default',
        }"
      />
      <span class="relative text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">{{ item.label }}</span>
      <span
        class="relative mt-1 block text-[1.15rem] font-extrabold tabular-nums tracking-tight"
        :class="{
          'text-amber-800': item.tone === 'accent',
          'text-danger': item.tone === 'danger',
          'text-ink': !item.tone || item.tone === 'default',
        }"
      >
        {{ item.value }}
      </span>
    </div>
  </section>
</template>
