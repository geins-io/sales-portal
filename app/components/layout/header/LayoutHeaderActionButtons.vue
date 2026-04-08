<script setup lang="ts">
import { ShoppingCart, Search, Menu } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useAppStore } from '~/stores/app';
import { useCartStore } from '~/stores/cart';

const appStore = useAppStore();
const cartStore = useCartStore();
const { localePath } = useLocaleMarket();
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Search icon (mobile only — desktop has inline SearchBar) -->
    <NuxtLink
      :to="localePath('/search')"
      data-slot="search-button"
      class="text-muted-foreground hover:text-foreground p-2 lg:hidden"
    >
      <Search class="size-5" />
    </NuxtLink>

    <!-- Cart -->
    <Button
      variant="ghost"
      data-slot="cart-button"
      class="gap-1.5"
      @click="cartStore.isOpen = true"
    >
      <ShoppingCart class="size-5" />
      <span
        v-if="cartStore.itemCount > 0"
        class="text-foreground text-sm font-medium"
      >
        {{ cartStore.itemCount }} {{ $t('cart.items_short') }}
      </span>
    </Button>

    <!-- Hamburger (mobile only) -->
    <Button
      variant="ghost"
      size="icon"
      data-slot="menu-toggle"
      data-testid="mobile-nav-trigger"
      class="lg:hidden"
      @click="appStore.toggleSidebar()"
    >
      <Menu class="size-5" />
    </Button>
  </div>
</template>
