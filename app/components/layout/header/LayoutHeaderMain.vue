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
  <div
    class="bg-background flex w-full items-center justify-between px-6 py-4 shadow-sm"
  >
    <div
      class="mx-auto flex w-full max-w-[1280px] items-center justify-between"
    >
      <!-- Logo -->
      <Logo />

      <!-- Search bar -->
      <SearchBar placeholder="Search products..." />

      <!-- Cart button -->
      <button
        class="text-foreground hover:bg-accent flex h-10 items-center gap-2 rounded-md bg-transparent px-6 py-2 text-sm font-medium"
      >
        <ShoppingCart class="size-4" />
        <span v-if="cartItemCount > 0">{{ cartItemCount }} items</span>
        <span v-else>Cart</span>
      </button>
    </div>
  </div>
</template>
