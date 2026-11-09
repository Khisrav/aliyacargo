<script setup lang="ts">
// Batch money now lives on the batch page itself; keep old links working.
const route = useRoute()
await navigateTo(`/acceptances/${route.params.id}`, { replace: true })
</script>

<template>
  <UiSpinner />
</template>
