<script setup lang="ts">
import { ArrowLeft, Lock } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- Minimal checkout header -->
    <header class="bg-neutral-900 text-white">
      <div
        class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8"
      >
        <!-- Left: Back to store -->
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-1.5 text-sm text-neutral-300 transition-colors hover:text-white"
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
          class="text-sm text-neutral-300"
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
