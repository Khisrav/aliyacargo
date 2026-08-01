<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'

withDefaults(defineProps<{
  name?: string
  phone?: string
  title?: string
  meta?: string
  initiator?: string | null
  hasPaid?: boolean
  readonly?: boolean
  paidLabel?: string
  unpaidLabel?: string
  showTrash?: boolean
}>(), {
  readonly: false,
  showTrash: true,
  paidLabel: 'Оплачено',
  unpaidLabel: 'Не оплачено',
})

defineEmits<{
  togglePaid: []
  remove: []
}>()
</script>

<template>
  <li class="ui-card flex items-center gap-3 px-4 py-3.5">
    <div class="min-w-0 flex-1">
      <p v-if="name || title" class="truncate text-[15px] font-extrabold text-ink">
        {{ title || name }}
      </p>
      <p class="mt-0.5 truncate text-xs font-medium text-muted">
        <span v-if="phone" class="mr-1 inline-block rounded-full border border-white/70 bg-white/50 px-2 py-0.5 font-bold tabular-nums text-ink/70">
          {{ formatPhone(phone) }}
        </span>
        <slot name="meta">
          {{ meta }}
        </slot>
      </p>
      <p v-if="initiator" class="mt-0.5 text-[11px] text-slate-400">
        Оплату отметил: {{ initiator }}
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <button
        v-if="!readonly"
        type="button"
        class="rounded-full px-3 py-2 text-xs font-extrabold transition active:scale-95"
        :class="hasPaid
          ? 'bg-gradient-to-br from-emerald-300 to-success text-white shadow-[0_6px_14px_rgba(21,128,61,0.28)]'
          : 'border border-white/70 bg-white/45 text-muted'"
        @click="$emit('togglePaid')"
      >
        {{ hasPaid ? `✓ ${paidLabel}` : unpaidLabel }}
      </button>
      <span
        v-else
        class="rounded-full px-3 py-2 text-xs font-extrabold"
        :class="hasPaid
          ? 'bg-gradient-to-br from-emerald-300 to-success text-white'
          : 'border border-white/70 bg-white/45 text-muted'"
      >
        {{ hasPaid ? paidLabel : unpaidLabel }}
      </span>
      <button
        v-if="!readonly && showTrash"
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 bg-danger-soft text-danger transition active:scale-95"
        aria-label="Удалить"
        @click="$emit('remove')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
        </svg>
      </button>
    </div>
  </li>
</template>
