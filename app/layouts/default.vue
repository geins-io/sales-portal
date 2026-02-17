<script setup lang="ts"></script>

<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main-content"
      class="bg-primary text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:px-4 focus:py-2"
    >
      {{ $t('layout.skip_to_content') }}
    </a>
    <SharedErrorBoundary section="header">
      <LayoutHeader />
    </SharedErrorBoundary>
    <main id="main-content" class="flex-1">
      <SharedErrorBoundary section="content">
        <slot />
      </SharedErrorBoundary>
    </main>
    <SharedErrorBoundary section="footer">
      <LayoutFooter />
    </SharedErrorBoundary>
    <LayoutMobileNavPanel />
    <PreviewBanner />
    <SharedCookieBanner />
  </div>
</template>
