<script setup lang="ts">
import type {
  HeaderVariant,
  HeaderAuthState,
  HeaderNavLink,
} from '#shared/types/layout';

interface Props {
  variant?: HeaderVariant;
  authState?: HeaderAuthState;
  navLinks?: HeaderNavLink[];
  cartItemCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  authState: 'logged-out',
  navLinks: () => [],
  cartItemCount: 22, // Static sample data from Figma
});
</script>

<template>
  <header class="sticky top-0 z-50 flex w-full flex-col">
    <LayoutHeaderTopbar :auth-state="props.authState" />
    <LayoutHeaderMain :cart-item-count="props.cartItemCount" />
    <LayoutHeaderNav :nav-links="props.navLinks" />
  </header>
</template>
