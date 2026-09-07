import { CmsPageSchema } from '../../../schemas/api-input';
import { getPage } from '../../../services/cms';
import { sanitizeCmsPage } from '../../../utils/cms-sanitize';
import { hasUserToken } from '../../../utils/request-identity';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = CmsPageSchema.parse({ alias });
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
