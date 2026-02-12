/**
 * Analytics plugin — conditionally loads GA/GTM based on tenant config
 * and the NUXT_PUBLIC_FEATURES_ANALYTICS feature flag.
 *
 * Uses @nuxt/scripts registry composables for privacy-aware, performance-optimized loading.
 * Only runs client-side — analytics scripts serve no purpose during SSR.
 */
export default defineNuxtPlugin({
  name: 'tenant-analytics',
  dependsOn: ['tenant-theme'],
  async setup() {
    // Analytics only makes sense on the client
    if (import.meta.server) return;

    const { tenant, suspense } = useTenant();

    await suspense();

    if (!tenant.value?.isActive) return;

    // Check the feature flag
    const config = useRuntimeConfig();
    if (!config.public.features.analytics) return;

    const gaId = tenant.value.seo?.googleAnalyticsId;
    const gtmId = tenant.value.seo?.googleTagManagerId;

    if (gaId) {
      useScriptGoogleAnalytics({ id: gaId });
    }

    if (gtmId) {
      useScriptGoogleTagManager({ id: gtmId });
    }
  },
});
