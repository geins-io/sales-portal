<script setup lang="ts">
/**
 * Rendered on the storefront landing page (`pages/index.vue`) when the
 * tenant has no FRONTPAGE_CONTENT CMS slot configured OR the configured
 * area returns no content. The page is the first thing a user sees —
 * we never want it to render as a blank `<div>`.
 *
 * Uses tenant branding for the hero title when available, English
 * fallback strings otherwise. Header navigation (above) remains the
 * primary way to explore — this component is a welcome mat, not a full
 * fallback layout.
 */
const { t } = useI18n();
const { tenant } = useTenant();

const brandName = computed(() => tenant.value?.branding?.name?.trim() || null);
</script>

<template>
  <section
    data-testid="frontpage-fallback"
    class="bg-muted/30"
    aria-labelledby="frontpage-fallback-title"
  >
    <div class="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
      <h1
        id="frontpage-fallback-title"
        class="text-3xl font-semibold sm:text-5xl"
      >
        <template v-if="brandName">
          {{ t('frontpage.fallback.welcome_named', { brand: brandName }) }}
        </template>
        <template v-else>
          {{ t('frontpage.fallback.welcome') }}
        </template>
      </h1>
      <p
        class="text-muted-foreground mx-auto mt-4 max-w-xl text-sm sm:text-base"
      >
        {{ t('frontpage.fallback.subtitle') }}
      </p>
    </div>
  </section>
</template>
