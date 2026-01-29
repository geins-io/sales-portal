<script setup lang="ts">
import { Search, X } from 'lucide-vue-next';

interface Props {
  placeholder?: string;
}

withDefaults(defineProps<Props>(), {
  placeholder: 'Search products...',
});

const searchQuery = ref('');
</script>

<template>
  <div
    class="border-border bg-popover flex h-12 w-full max-w-[512px] items-center gap-2 rounded-md border px-3 shadow-sm"
  >
    <Search class="text-muted-foreground size-4 opacity-50" />
    <input
      v-model="searchQuery"
      type="text"
      :placeholder="placeholder"
      class="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm focus:outline-none"
    />
    <button
      v-if="searchQuery"
      type="button"
      class="text-muted-foreground hover:text-foreground"
      @click="searchQuery = ''"
    >
      <X class="size-3" />
    </button>
    <div class="flex items-center gap-1">
      <kbd
        class="bg-muted text-muted-foreground flex h-5 min-w-[20px] items-center justify-center rounded px-1 text-xs font-medium"
      >
        ⌘F
      </kbd>
    </div>
  </div>
</template>
