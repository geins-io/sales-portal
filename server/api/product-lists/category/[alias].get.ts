import { ListPageSchema } from '../../../schemas/api-input';
import { getCategoryPage } from '../../../services/product-lists';

export default defineEventHandler(async (event) => {
  const parsed = ListPageSchema.safeParse({
    alias: getRouterParam(event, 'alias'),
  });
  // A miss, not a 500: the page shows its error page for anything but a 404.
  if (!parsed.success) {
    throw createAppError(ErrorCode.NOT_FOUND, 'Category page not found');
  }
  const validatedAlias = parsed.data.alias;
  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      const page = await getCategoryPage(
        { alias: validatedAlias, userToken: auth?.authToken },
        event,
      );

      if (!page) {
        // Don't let the CDN cache the 404. A freshly-published category would
        // otherwise stay 404 for the s-maxage window on every edge.
        setResponseHeader(event, 'Cache-Control', 'no-store');
        throw createAppError(ErrorCode.NOT_FOUND, 'Category page not found');
      }

      // `listPageInfo.id` IS the categoryId — verified on both tenants
      // (fastelement 1, testkategori-l6 12, skyddsutrustning 17). The trail is
      // walked out of the cached category tree rather than derived from
      // canonicalUrl, which Geins caps at MaxCategoryDepth segments.
      const ancestors = await resolveEntityAncestors(
        (page as { id?: number }).id,
        event,
      );
      return { ...page, ancestors };
    },
    { operation: 'product-lists.category.get' },
  );
});
