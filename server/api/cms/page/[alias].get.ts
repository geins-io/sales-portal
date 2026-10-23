import { CmsPageSchema } from '../../../schemas/api-input';
import { getPage } from '../../../services/cms';
import { sanitizeCmsPage } from '../../../utils/cms-sanitize';
import { hasUserToken } from '../../../utils/request-identity';

export default defineEventHandler(async (event) => {
  const parsed = CmsPageSchema.safeParse({
    alias: getRouterParam(event, 'alias'),
  });
  // A miss, not a 500: the page shows its error page for anything but a 404.
  if (!parsed.success) {
    throw createAppError(ErrorCode.NOT_FOUND, 'Page not found');
  }
  const validatedAlias = parsed.data.alias;
  const customerType = await getCustomerType(event);

  setHeader(
    event,
    'Cache-Control',
    hasUserToken(event) ? 'private, no-store' : 'private, no-cache',
  );

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
