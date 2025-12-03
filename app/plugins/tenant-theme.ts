const sanitizeCustomCss = (css: string | undefined) => {
  if (!css) return '';
  return css.replace(/st<yle>|<\/style>/g, '').trim();
};

const sanitizeTitle = (title: string | undefined) => {
  if (!title) return '';
  return title;
};

export default defineNuxtPlugin({
  name: 'tenant-theme',
  async setup() {
    const { data: tenantConfig } = await useApi<TenantConfig>('/api/config');

    useHead({
      titleTemplate: `%s - ${sanitizeTitle(tenantConfig.value?.tenantId)}`,
      htmlAttrs: { 'data-theme': tenantConfig.value?.theme?.name || 'default' },
      style: [
        {
          innerHTML: () => sanitizeCustomCss(tenantConfig.value?.css),
          tagPosition: 'bodyOpen',
        },
      ],
    });
  },
});
