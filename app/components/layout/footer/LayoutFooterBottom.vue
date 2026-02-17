<script setup lang="ts"></script>

<template>
  <div data-slot="footer-bottom" class="border-t px-6 py-6 lg:px-8">
    <div class="mx-auto flex max-w-7xl flex-col items-center gap-4">
      <!-- Top row: copyright + legal links -->
      <div
        class="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-between"
      >
        <Copyright />
        <nav class="flex gap-4 text-sm">
          <NuxtLink
            to="/privacy"
            class="text-muted-foreground hover:text-foreground transition-colors"
          >
            {{ $t('layout.privacy_policy') }}
          </NuxtLink>
          <NuxtLink
            to="/terms"
            class="text-muted-foreground hover:text-foreground transition-colors"
          >
            {{ $t('layout.terms_of_service') }}
          </NuxtLink>
          <NuxtLink
            to="/cookies"
            class="text-muted-foreground hover:text-foreground transition-colors"
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
