<script setup lang="ts">
import { ArrowLeft, Lock } from 'lucide-vue-next';

const { localePath } = useLocaleMarket();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- Minimal checkout header -->
    <header class="bg-top-bar-background text-primary-foreground">
      <!-- Equal outer columns keep the title centred whatever the left holds. -->
      <div
        class="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 lg:px-6"
      >
        <div class="flex items-center gap-2 lg:gap-4">
          <NuxtLink
            :to="localePath('/')"
            :aria-label="$t('checkout.back_to_store')"
            class="inline-flex items-center gap-1.5 text-sm opacity-70 transition-opacity hover:opacity-100"
            data-testid="checkout-back-link"
          >
            <ArrowLeft class="size-4" />
            <span class="hidden lg:inline">{{
              $t('checkout.back_to_store')
            }}</span>
          </NuxtLink>
          <VatDisplaySwitcher variant="text" />
        </div>

        <div
          class="inline-flex items-center gap-1.5 text-sm font-medium"
          data-testid="checkout-header-title"
        >
          <Lock class="size-3.5" />
          {{ $t('checkout.title') }}
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
