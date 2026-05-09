<script setup lang="ts">
import { Mail, User } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const { localePath } = useLocaleMarket();
</script>

<template>
  <div
    data-slot="topbar"
    class="bg-top-bar-background text-top-bar-text w-full text-sm"
  >
    <div class="flex h-10 items-center justify-between px-4 lg:px-6">
      <!-- Left: Contact + Locale -->
      <div class="flex items-center gap-4">
        <NuxtLink
          :to="localePath('/contact')"
          class="flex items-center gap-1.5 hover:underline"
        >
          <Mail class="size-4" />
          <span class="hidden sm:inline">{{ $t('layout.contact_us') }}</span>
          <span class="sm:hidden">{{ $t('layout.contact') }}</span>
        </NuxtLink>
        <LocaleSwitcher variant="text" />
        <MarketSwitcher variant="text" />
      </div>

      <!-- Center: Env badge (dev only) -->
      <div
        v-if="
          $config?.public?.environment &&
          $config.public.environment !== 'production'
        "
        class="font-mono text-xs uppercase opacity-75"
      >
        {{ $config.public.environment }}
      </div>

      <!-- Right: Apply + Login -->
      <div class="flex items-center gap-4">
        <NuxtLink
          :to="localePath('/apply-for-account')"
          class="hidden hover:underline sm:inline"
        >
          {{ $t('layout.apply_for_account') }}
        </NuxtLink>
        <button
          v-if="!authStore.isAuthenticated"
          type="button"
          class="flex items-center gap-1.5 hover:underline"
          data-testid="topbar-login"
          @click="authStore.openSheet()"
        >
          <User class="size-4" />
          <span>{{ $t('auth.login') }}</span>
        </button>
        <NuxtLink
          v-else
          :to="localePath('/portal')"
          class="flex items-center gap-1.5 hover:underline"
        >
          <User class="size-4" />
          <span>{{ authStore.displayName }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
