<script setup lang="ts">
import { Mail, User } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
</script>

<template>
  <div
    data-slot="topbar"
    class="bg-primary text-primary-foreground w-full text-sm"
  >
    <div
      class="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 lg:px-8"
    >
      <!-- Left: Contact + Locale -->
      <div class="flex items-center gap-4">
        <NuxtLink
          to="/contact"
          class="flex items-center gap-1.5 hover:underline"
        >
          <Mail class="size-4" />
          <span class="hidden sm:inline">{{ $t('layout.contact_us') }}</span>
          <span class="sm:hidden">{{ $t('layout.contact') }}</span>
        </NuxtLink>
        <LocaleSwitcher variant="text" />
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
        <NuxtLink to="/apply" class="hidden hover:underline sm:inline">
          {{ $t('layout.apply_for_account') }}
        </NuxtLink>
        <NuxtLink
          v-if="!authStore.isAuthenticated"
          to="/login"
          class="flex items-center gap-1.5 hover:underline"
        >
          <User class="size-4" />
          <span>{{ $t('auth.login') }}</span>
        </NuxtLink>
        <NuxtLink
          v-else
          to="/portal"
          class="flex items-center gap-1.5 hover:underline"
        >
          <User class="size-4" />
          <span>{{ authStore.displayName }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
