<script setup lang="ts">
const { isPreview, exitPreview } = useCmsPreview();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isPreview"
      class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-black shadow-lg"
    >
      <span>Preview Mode</span>
      <button
        class="rounded-full bg-black/20 px-3 py-0.5 text-xs font-semibold transition-colors hover:bg-black/30"
        @click="exitPreview"
      >
        Exit
      </button>
    </div>
  </Teleport>
</template>
