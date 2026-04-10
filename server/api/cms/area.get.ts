import { CmsAreaSchema } from '../../schemas/api-input';
import { getContentArea } from '../../services/cms';
import { sanitizeCmsArea } from '../../utils/cms-sanitize';

export default defineEventHandler(async (event) => {
  const { family, areaName } = await getValidatedQuery(
    event,
    CmsAreaSchema.parse,
  );
  const customerType = await getCustomerType(event);

  if (customerType) {
    setHeader(event, 'Cache-Control', 'private, no-store');
  } else {
    setHeader(event, 'Cache-Control', 'private, no-cache');
  }

  return withErrorHandling(
    async () => {
      const area = await getContentArea(
        { family, areaName, customerType },
        event,
      );

      if (area?.containers?.length) {
        return sanitizeCmsArea(area);
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
          const fallback = await getContentArea(
            { family, areaName, customerType },
            event,
          );
          if (fallback?.containers?.length) {
            return sanitizeCmsArea(fallback);
          }
        } finally {
          event.context.resolvedLocaleMarket = originalResolved;
        }
      }

      throw createAppError(ErrorCode.NOT_FOUND, 'Content area not found');
    },
    { operation: 'cms.area.get' },
  );
});
