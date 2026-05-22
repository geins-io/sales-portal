<script setup lang="ts">
// Cart hydration runs in `app/plugins/cart-init.ts` (universal plugin).
// See docs/patterns/cart-hydration.md for the rationale.
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <PreviewBanner />
    <ImpersonationBanner />
    <a
      href="#main-content"
      class="bg-primary text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:px-4 focus:py-2"
    >
      {{ $t('layout.skip_to_content') }}
    </a>
    <ErrorBoundary section="header">
      <LayoutHeader />
    </ErrorBoundary>
    <main id="main-content" class="flex-1">
      <ErrorBoundary section="content">
        <slot />
      </ErrorBoundary>
    </main>
    <ErrorBoundary section="footer">
      <LayoutFooter />
    </ErrorBoundary>
    <MobileNavPanel />
    <CookieBanner />
    <CartDrawer />
    <AuthSheet />
  </div>
</template>
