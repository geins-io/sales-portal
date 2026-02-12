import { buildGoogleFontsUrl } from '#shared/utils/fonts';

const sanitizeCustomCss = (css: string | undefined) => {
  if (!css) return '';
  return css.replace(/<style>|<\/style>/gi, '').trim();
};

/**
 * Build head link entries for Google Fonts.
 * Includes preconnect hints + stylesheet link for fast font loading (no FOUT).
 */
function buildFontLinks(
  typography?: {
    fontFamily: string;
    headingFontFamily?: string | null;
    monoFontFamily?: string | null;
  } | null,
): Array<Record<string, string>> {
  const fontsUrl = buildGoogleFontsUrl(typography);
  if (!fontsUrl) return [];

  return [
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossorigin: 'anonymous',
    },
    {
      rel: 'stylesheet',
      href: fontsUrl,
    },
  ];
}

export default defineNuxtPlugin({
  name: 'tenant-theme',
  async setup() {
    const { tenant, theme, hostname, tenantId, faviconUrl, suspense } =
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

    // Build link entries: favicon + Google Fonts (preconnect + stylesheet)
    const links: Array<Record<string, string>> = [
      { rel: 'icon', href: faviconUrl.value, type: 'image/x-icon' },
      ...buildFontLinks(theme.value?.typography),
    ];

    useHead({
      htmlAttrs: {
        'data-theme': theme.value?.name?.toLowerCase() || 'default',
      },
      link: links,
      style: [
        {
          innerHTML: () => sanitizeCustomCss(tenant.value?.css),
          tagPosition: 'head',
        },
      ],
    });
  },
});
