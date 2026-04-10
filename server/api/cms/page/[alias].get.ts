import { CmsPageSchema } from '../../../schemas/api-input';
import { getPage } from '../../../services/cms';
import { sanitizeCmsPage } from '../../../utils/cms-sanitize';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = CmsPageSchema.parse({ alias });
  const customerType = await getCustomerType(event);

  if (customerType) {
    setHeader(event, 'Cache-Control', 'private, no-store');
  } else {
    setHeader(event, 'Cache-Control', 'private, no-cache');
  }

  return withErrorHandling(
    async () => {
      const page = await getPage(
        { alias: validatedAlias, customerType },
        event,
      );

      if (page?.containers?.length) {
        return sanitizeCmsPage(page);
      }

      // Fallback: retry with tenant's default locale if current locale has no content
      const defaultLocale = event.context.tenant?.config?.geinsSettings?.locale;
      const requestLocale = getRequestLocale(event);
      if (defaultLocale && requestLocale && requestLocale !== defaultLocale) {
        const originalResolved = event.context.resolvedLocaleMarket;
        const fallbackLocale = defaultLocale as string;
        const shortLocale = fallbackLocale.split('-')[0] ?? fallbackLocale;
        const fallbackMarket =
          originalResolved?.market ?? getRequestMarket(event) ?? 'se';
        event.context.resolvedLocaleMarket = {
          market: fallbackMarket as string,
          locale: shortLocale as string,
          localeBcp47: fallbackLocale,
        };
        try {
          const fallback = await getPage(
            { alias: validatedAlias, customerType },
            event,
          );
          if (fallback?.containers?.length) {
            return sanitizeCmsPage(fallback);
          }
        } finally {
          event.context.resolvedLocaleMarket = originalResolved;
        }
      }

      throw createAppError(ErrorCode.NOT_FOUND, 'Page not found');
    },
    { operation: 'cms.page.get' },
  );
});
