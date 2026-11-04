import { CmsPageSchema } from '../../../schemas/api-input';
import { getListedCmsPage, getPage } from '../../../services/cms';
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

      if (page?.containers?.length) return sanitizeCmsPage(page);

      // A published page renders even with no blocks for this visitor.
      const listed = await getListedCmsPage({ alias: validatedAlias }, event);
      if (!listed) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Page not found');
      }

      return {
        id: String(listed.id),
        name: listed.name,
        title: listed.title || listed.name,
        meta: {
          title: listed.meta?.title ?? undefined,
          description: listed.meta?.description ?? undefined,
        },
        tags: listed.tags,
        containers: [],
      };
    },
    { operation: 'cms.page.get' },
  );
});
