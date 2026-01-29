<script setup lang="ts">
import { ShoppingCart } from 'lucide-vue-next';

interface Props {
  cartItemCount?: number;
}

withDefaults(defineProps<Props>(), {
  cartItemCount: 0,
});
</script>

<template>
  <div class="flex items-center gap-4">
    <button
      class="text-foreground hover:bg-accent flex h-10 items-center gap-2 rounded-md bg-transparent px-6 py-2 text-sm font-medium"
    >
      <ShoppingCart class="size-4" />
      <span v-if="cartItemCount > 0">{{ cartItemCount }} items</span>
      <span v-else>Cart</span>
    </button>
  </div>
</template>
