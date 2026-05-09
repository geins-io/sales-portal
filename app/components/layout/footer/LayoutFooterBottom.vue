<script setup lang="ts">
const { localePath } = useLocaleMarket();
</script>

<template>
  <div data-slot="footer-bottom" class="px-6 py-8 lg:px-6">
    <div
      class="border-footer-text/20 mx-auto flex max-w-7xl flex-col items-center gap-4 border-t pt-8"
    >
      <!-- Top row: copyright + legal links -->
      <div
        class="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-between"
      >
        <Copyright />
        <nav class="flex gap-4 text-sm">
          <NuxtLink
            :to="localePath('/privacy')"
            class="text-footer-text/70 hover:text-footer-text transition-colors"
          >
            {{ $t('layout.privacy_policy') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/terms')"
            class="text-footer-text/70 hover:text-footer-text transition-colors"
          >
            {{ $t('layout.terms_of_service') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/cookies')"
            class="text-footer-text/70 hover:text-footer-text transition-colors"
          >
            {{ $t('layout.cookies_settings') }}
          </NuxtLink>
        </nav>
      </div>

      <!-- Powered by -->
      <PoweredBy />
    </div>
  </div>
</template>
