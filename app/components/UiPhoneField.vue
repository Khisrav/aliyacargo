<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  hint?: string
  modelValue: string
  lookingUp?: boolean
  found?: boolean
  foundText?: string
  lookingText?: string
}>(), {})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [e: Event]
  enter: []
  focus: []
  blur: []
}>()

const inputRef = ref<HTMLInputElement>()

defineExpose({
  focus: () => inputRef.value?.focus(),
  el: inputRef,
})
</script>

<template>
  <label class="ui-field">
    <span v-if="label" class="ui-label">
      {{ label }}
      <span v-if="hint" class="ml-1 font-medium normal-case tracking-normal text-slate-400">{{ hint }}</span>
    </span>
    <div class="flex items-center gap-2 rounded-[1.35rem] border border-white/70 bg-white/55 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-2 ring-transparent transition focus-within:border-brand/35 focus-within:bg-white/80 focus-within:ring-brand/15">
      <span class="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-sm font-extrabold text-brand-dark">+992</span>
      <input
        ref="inputRef"
        :value="modelValue"
        type="text"
        inputmode="numeric"
        autocomplete="tel"
        enterkeyhint="next"
        placeholder="### ##-##-##"
        class="w-full border-0 bg-transparent py-3.5 text-[22px] font-extrabold tracking-wider text-ink tabular-nums placeholder:font-semibold placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none"
        @input="emit('input', $event); emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('enter')"
        @focus="emit('focus')"
        @blur="emit('blur')"
      >
    </div>
    <span v-if="lookingUp" class="text-xs font-medium text-muted">{{ lookingText || 'Ищем клиента…' }}</span>
    <span v-else-if="found" class="text-xs font-semibold text-success">{{ foundText || 'Клиент найден' }}</span>
  </label>
</template>
