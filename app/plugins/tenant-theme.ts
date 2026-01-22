import type { TenantConfig } from '#shared/types/tenant-config';

const sanitizeCustomCss = (css: string | undefined) => {
  if (!css) return '';
  return css.replace(/<style>|<\/style>/gi, '').trim();
};

const sanitizeTitle = (title: string | undefined) => {
  if (!title) return '';
  return title;
};

export default defineNuxtPlugin({
  name: 'tenant-theme',
  async setup() {
    const { data: tenantConfig } = await useApi<TenantConfig>('/api/config');
    console.log('tenant-theme - tenantConfig', tenantConfig.value?.hostname);
    console.log('tenant-theme - isActive', tenantConfig.value?.isActive);
    if (!tenantConfig.value?.isActive) {
      throw showError({
        statusCode: 404,
        statusMessage: 'Page Not Found',
        message: `The requested page could not be found. [${tenantConfig.value?.hostname}] , [${tenantConfig.value?.tenantId}]`,
        fatal: true,
      });
    }

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
