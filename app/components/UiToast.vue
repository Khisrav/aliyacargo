<script setup lang="ts">
defineProps<{
  toast: { type: 'success' | 'error', message: string } | null
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="toast"
        class="pointer-events-none fixed inset-x-4 z-[100] rounded-[1.35rem] px-4 py-3.5 text-center text-[15px] font-extrabold text-white shadow-toast backdrop-blur-md"
        :class="[
          toast.type === 'success'
            ? 'bg-gradient-to-br from-emerald-400/95 to-success'
            : 'bg-gradient-to-br from-rose-400/95 to-danger',
          'bottom-[calc(6.75rem+env(safe-area-inset-bottom,0px))]',
        ]"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
</style>
