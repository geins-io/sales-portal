<script setup lang="ts">
import { LogIn } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';
import { useCartStore } from '~/stores/cart';

const authStore = useAuthStore();
const cartStore = useCartStore();

// The sign-in sheet takes the drawer's place rather than stacking over it.
function signIn() {
  cartStore.isOpen = false;
  authStore.openSheet();
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 px-4 text-center">
    <LogIn class="text-muted-foreground size-12" />
    <p class="text-muted-foreground text-sm">
      {{ $t('cart.sign_in_to_see_cart') }}
    </p>
    <Button @click="signIn">{{ $t('auth.sign_in') }}</Button>
  </div>
</template>
