<script setup lang="ts">
import { formatPhone } from '#shared/utils/phone'
import { trackCountLabel } from '#shared/utils/tracks'

const props = withDefaults(defineProps<{
  name?: string
  phone?: string
  title?: string
  weight?: string
  price?: string
  when?: string
  initiator?: string | null
  hasPaid?: boolean
  readonly?: boolean
  paidLabel?: string
  unpaidLabel?: string
  showTrash?: boolean
  showEdit?: boolean
  trackCount?: number
  paidAt?: string
}>(), {
  readonly: false,
  showTrash: true,
  showEdit: false,
  paidLabel: 'Оплачено',
  unpaidLabel: 'Не оплачено',
  trackCount: 0,
  paidAt: '',
  weight: '',
  price: '',
  when: '',
})

defineEmits<{
  togglePaid: []
  remove: []
  edit: []
  viewTracks: []
}>()

const leadWithFacts = computed(() => !props.name && !props.title)
</script>

<template>
  <li class="ui-card flex items-center gap-3 px-4 py-3.5">
    <div class="min-w-0 flex-1 space-y-1.5">
      <p v-if="name || title" class="truncate text-[15px] font-extrabold text-ink">
        {{ title || name }}
      </p>
      <p v-if="phone">
        <span class="inline-block rounded-full border border-white/70 bg-white/50 px-2 py-0.5 text-xs font-bold tabular-nums text-ink/70">
          {{ formatPhone(phone) }}
        </span>
      </p>
      <div v-if="weight || price || when" class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <UiFact v-if="weight" icon="weight" :value="weight" :emphasis="leadWithFacts" />
        <UiFact v-if="price" icon="price" :value="price" :emphasis="leadWithFacts" />
        <UiFact v-if="when" icon="date" :value="when" :emphasis="leadWithFacts" />
      </div>
      <div v-if="paidAt || initiator" class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <UiFact v-if="paidAt" icon="date" :value="paidAt" />
        <UiFact v-if="initiator" icon="user" :value="initiator" />
      </div>
      <button
        v-if="trackCount > 0"
        type="button"
        class="text-xs font-extrabold text-brand"
        @click="$emit('viewTracks')"
      >
        {{ trackCountLabel(trackCount) }}
      </button>
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <button
        v-if="!readonly && showEdit"
        type="button"
        class="ui-icon-btn"
        aria-label="Изменить"
        @click="$emit('edit')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        v-if="!readonly"
        type="button"
        class="flex h-9 items-center justify-center rounded-full text-xs font-extrabold transition active:scale-95"
        :class="hasPaid
          ? 'w-9 bg-gradient-to-br from-emerald-300 to-success text-white shadow-[0_6px_14px_rgba(21,128,61,0.28)]'
          : 'border border-white/70 bg-white/45 px-2.5 text-muted'"
        :aria-label="hasPaid ? paidLabel : unpaidLabel"
        @click="$emit('togglePaid')"
      >
        <svg
          v-if="hasPaid"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span v-else>Долг</span>
      </button>
      <span
        v-else
        class="flex h-9 items-center justify-center rounded-full text-xs font-extrabold"
        :class="hasPaid
          ? 'w-9 bg-gradient-to-br from-emerald-300 to-success text-white'
          : 'border border-white/70 bg-white/45 px-2.5 text-muted'"
        :aria-label="hasPaid ? paidLabel : unpaidLabel"
      >
        <svg
          v-if="hasPaid"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span v-else>Долг</span>
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
