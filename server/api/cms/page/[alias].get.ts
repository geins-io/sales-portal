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
    setHeader(
      event,
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=600',
    );
    setHeader(event, 'Vary', 'cookie');
  }

  return withErrorHandling(
    async () => {
      const page = await getPage(
        { alias: validatedAlias, customerType },
        event,
      );

      if (!page?.containers?.length) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Page not found');
      }

      return sanitizeCmsPage(page);
    },
    { operation: 'cms.page.get' },
  );
});
