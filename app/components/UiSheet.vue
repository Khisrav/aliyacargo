<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[80] bg-ink/35 backdrop-blur-[6px]"
        @click="close"
      />
    </Transition>
    <Transition name="sheet">
      <div
        v-if="modelValue"
        class="ui-glass-strong fixed inset-x-0 bottom-0 z-[90] max-h-[88dvh] overflow-y-auto rounded-t-[2rem] shadow-sheet"
        role="dialog"
        aria-modal="true"
      >
        <div class="sticky top-0 z-10 flex justify-center bg-transparent px-4 pb-2 pt-3">
          <div class="h-1.5 w-12 rounded-full bg-ink/15" />
        </div>
        <div class="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-1">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.24s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
.sheet-enter-active {
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.sheet-leave-active {
  transition: transform 0.22s ease-in;
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}
</style>
