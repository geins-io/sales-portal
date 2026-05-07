<script setup lang="ts">
import { ArrowLeft, Lock } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const { localePath } = useLocaleMarket();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- Minimal checkout header -->
    <header class="bg-top-bar-background text-primary-foreground">
      <div
        class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-6"
      >
        <!-- Left: Back to store -->
        <NuxtLink
          :to="localePath('/')"
          class="inline-flex items-center gap-1.5 text-sm opacity-70 transition-opacity hover:opacity-100"
          data-testid="checkout-back-link"
        >
          <ArrowLeft class="size-4" />
          {{ $t('checkout.back_to_store') }}
        </NuxtLink>

        <!-- Center: Checkout title with lock -->
        <div class="inline-flex items-center gap-1.5 text-sm font-medium">
          <Lock class="size-3.5" />
          {{ $t('checkout.title') }}
        </div>

        <!-- Right: User name -->
        <span
          v-if="authStore.displayName"
          class="text-sm opacity-70"
          data-testid="checkout-user-name"
        >
          {{ authStore.displayName }}
        </span>
        <span v-else />
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
