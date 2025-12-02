const sanitizeCustomCss = (css: string) => {
  if (!css) return '';
  return css.replace(/<style>|<\/style>/g, '').trim();
};

export default defineNuxtPlugin({
  name: 'tenant-theme',
  async setup() {
    const { data: tenantConfig } = await useApi<TenantConfig>('/api/config');
    console.log('tenant-theme -> tenantConfig', tenantConfig.value);

    useHead({
      // Add a `data-theme` attribute to the root <html> element
      htmlAttrs: { 'data-theme': tenantConfig.value?.theme?.name || 'default' },
      style: [
        {
          innerHTML: () => sanitizeCustomCss(tenantConfig.value?.css),
          tagPosition: 'head',
        },
      ],
    });
  },
});
