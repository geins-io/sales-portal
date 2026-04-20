<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <section
    data-testid="portal-hero-fallback"
    class="bg-neutral-800 text-white"
    aria-labelledby="portal-hero-title"
  >
    <div class="mx-auto max-w-6xl px-4 py-12 text-center sm:py-16">
      <p class="text-xs tracking-wider text-white/60 uppercase">
        {{ t('portal.hero.cms_hint') }}
      </p>
      <h1
        id="portal-hero-title"
        class="mt-2 text-2xl font-semibold sm:text-4xl"
      >
        {{ t('portal.hero.fallback_title') }}
      </h1>
      <p class="mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">
        {{ t('portal.hero.fallback_subtitle') }}
      </p>
    </div>
  </section>
</template>
