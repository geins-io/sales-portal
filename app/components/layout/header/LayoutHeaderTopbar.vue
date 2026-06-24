<script setup lang="ts">
import { LogOut, Mail, User } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';
import { CMS_TAGS } from '#shared/constants/cms';

const authStore = useAuthStore();
const { localePath } = useLocaleMarket();
const { hasFeature } = useTenant();
const { logout } = useLogout();
const { to: contactTo, isResolved: contactResolved } = useCmsPageLink(
  CMS_TAGS.CONTACT_PAGE,
);
const { to: applyTo, isResolved: applyResolved } = useCmsPageLink(
  CMS_TAGS.APPLY_PAGE,
);
</script>

<template>
  <div
    data-slot="topbar"
    class="bg-top-bar-background text-top-bar-text w-full text-sm"
  >
    <div class="flex h-12 items-center justify-between px-4 lg:px-6">
      <!-- Left: Contact + Locale -->
      <div class="flex items-center gap-4">
        <NuxtLink
          v-if="contactResolved"
          :to="contactTo"
          :aria-label="$t('layout.contact_us')"
          class="flex items-center gap-1.5 py-2 hover:underline"
        >
          <Mail class="size-4" />
          <span class="hidden sm:inline">{{ $t('layout.contact_us') }}</span>
        </NuxtLink>
        <LocaleSwitcher variant="text" />
        <MarketSwitcher variant="text" />
        <VatDisplaySwitcher variant="text" />
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
          v-if="
            hasFeature('applyForAccount') &&
            !authStore.isAuthenticated &&
            applyResolved
          "
          :to="applyTo"
          class="hidden hover:underline sm:inline"
        >
          {{ $t('layout.apply_for_account') }}
        </NuxtLink>
        <button
          v-if="!authStore.isAuthenticated"
          type="button"
          :aria-label="$t('auth.login')"
          class="flex items-center gap-1.5 py-2 hover:underline"
          data-testid="topbar-login"
          @click="authStore.openSheet()"
        >
          <User class="size-4" />
          <span class="hidden sm:inline">{{ $t('auth.login') }}</span>
        </button>
        <template v-else>
          <NuxtLink
            :to="localePath('/portal')"
            :aria-label="$t('layout.customer_portal')"
            class="flex items-center gap-1.5 py-2 hover:underline"
            data-testid="topbar-portal"
          >
            <User class="size-4" />
            <span class="hidden sm:inline">{{
              $t('layout.customer_portal')
            }}</span>
          </NuxtLink>
          <button
            type="button"
            :aria-label="$t('auth.logout')"
            class="hidden items-center gap-1.5 py-2 hover:underline lg:flex"
            data-testid="topbar-logout"
            @click="logout"
          >
            <LogOut class="size-4" />
            <span class="hidden sm:inline">{{ $t('auth.logout') }}</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
