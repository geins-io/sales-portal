<script setup lang="ts">
import { ShoppingCart, Search, Menu } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useCartStore } from '~/stores/cart';

const appStore = useAppStore();
const cartStore = useCartStore();
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Search icon (mobile only — desktop has inline SearchBar) -->
    <NuxtLink
      to="/search"
      data-slot="search-button"
      class="text-muted-foreground hover:text-foreground p-2 lg:hidden"
    >
      <Search class="size-5" />
    </NuxtLink>

    <!-- Cart -->
    <button
      type="button"
      data-slot="cart-button"
      class="text-muted-foreground hover:text-foreground flex items-center gap-1.5 p-2"
      @click="cartStore.isOpen = true"
    >
      <ShoppingCart class="size-5" />
      <span
        v-if="cartStore.itemCount > 0"
        class="text-foreground text-sm font-medium"
      >
        {{ cartStore.itemCount }} {{ $t('cart.items_short') }}
      </span>
    </button>

    <!-- Hamburger (mobile only) -->
    <button
      data-slot="menu-toggle"
      type="button"
      class="text-muted-foreground hover:text-foreground p-2 lg:hidden"
      @click="appStore.toggleSidebar()"
    >
      <Menu class="size-5" />
    </button>
  </div>
</template>
