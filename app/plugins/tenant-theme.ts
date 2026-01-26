const sanitizeCustomCss = (css: string | undefined) => {
  if (!css) return '';
  return css.replace(/<style>|<\/style>/gi, '').trim();
};

export default defineNuxtPlugin({
  name: 'tenant-theme',
  async setup() {
    const { tenant, brandName, theme, hostname, tenantId, suspense } =
      useTenant();

    // Wait for tenant data to be loaded (important for SSR)
    await suspense();

    if (!tenant.value?.isActive) {
      throw showError({
        statusCode: 418,
        statusMessage: "I'm a teapot",
        message: `The requested page could not be found. [${hostname.value}] , [${tenantId.value}]`,
        fatal: true,
      });
    }

    useHead({
      titleTemplate: `%s - ${brandName.value}`,
      htmlAttrs: { 'data-theme': theme.value?.name || 'default' },
      style: [
        {
          innerHTML: () => sanitizeCustomCss(tenant.value?.css),
          tagPosition: 'bodyOpen',
        },
      ],
    });
  },
});
