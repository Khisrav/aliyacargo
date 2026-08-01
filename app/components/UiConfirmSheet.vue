<script setup lang="ts">
const { state, respond } = useConfirm()
</script>

<template>
  <UiSheet :model-value="state.open" @update:model-value="(v) => !v && respond(false)">
    <div class="space-y-4 pt-2">
      <div>
        <h2 class="text-xl font-extrabold tracking-tight text-ink">
          {{ state.title }}
        </h2>
        <p v-if="state.message" class="mt-2 text-sm leading-relaxed text-muted">
          {{ state.message }}
        </p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <button type="button" class="ui-btn-ghost" @click="respond(false)">
          {{ state.cancelLabel }}
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-bold transition active:scale-[0.98]"
          :class="state.danger ? 'bg-danger text-white shadow-[0_8px_20px_rgba(220,38,38,0.25)]' : 'bg-brand text-white shadow-[0_8px_20px_rgba(15,118,110,0.28)]'"
          @click="respond(true)"
        >
          {{ state.confirmLabel }}
        </button>
      </div>
    </div>
  </UiSheet>
</template>
