<script setup lang="ts"></script>

<template>
  <div
    data-slot="footer-bottom"
    class="border-t border-neutral-800 px-6 py-6 lg:px-8"
  >
    <div class="mx-auto flex max-w-7xl flex-col items-center gap-4">
      <!-- Top row: copyright + legal links -->
      <div
        class="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-between"
      >
        <Copyright />
        <nav class="flex gap-4 text-sm">
          <NuxtLink
            to="/privacy"
            class="text-neutral-400 transition-colors hover:text-white"
          >
            {{ $t('layout.privacy_policy') }}
          </NuxtLink>
          <NuxtLink
            to="/terms"
            class="text-neutral-400 transition-colors hover:text-white"
          >
            {{ $t('layout.terms_of_service') }}
          </NuxtLink>
          <NuxtLink
            to="/cookies"
            class="text-neutral-400 transition-colors hover:text-white"
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
