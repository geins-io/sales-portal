import { CmsPageSchema } from '../../../schemas/api-input';
import { getPage } from '../../../services/cms';
import { sanitizeCmsPage } from '../../../utils/cms-sanitize';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = CmsPageSchema.parse({ alias });

  return withErrorHandling(
    async () => {
      const page = await getPage({ alias: validatedAlias }, event);

      if (!page?.containers?.length) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Page not found');
      }

      return sanitizeCmsPage(page);
    },
    { operation: 'cms.page.get' },
  );
});
