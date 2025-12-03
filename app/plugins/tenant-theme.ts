const sanitizeCustomCss = (css: string | undefined) => {
  if (!css) return '';
  return css.replace(/<style>|<\/style>/g, '').trim();
};

export default defineNuxtPlugin({
  name: 'tenant-theme',
  async setup() {
    const { data: tenantConfig } = await useApi<TenantConfig>('/api/config');
    useHead({
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
