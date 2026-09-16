import { ListPageSchema } from '../../../schemas/api-input';
import { getCategoryPage } from '../../../services/product-lists';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ListPageSchema.parse({ alias });
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
