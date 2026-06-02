import { ListPageSchema } from '../../../schemas/api-input';
import { getBrandPage } from '../../../services/product-lists';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ListPageSchema.parse({ alias });
  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      const page = await getBrandPage(
        { alias: validatedAlias, userToken: auth?.authToken },
        event,
      );

      if (!page) {
        // Don't let the CDN cache the 404. A freshly-published brand would
        // otherwise stay 404 for the s-maxage window on every edge.
        setResponseHeader(event, 'Cache-Control', 'no-store');
        throw createAppError(ErrorCode.NOT_FOUND, 'Brand page not found');
      }

      return page;
    },
    { operation: 'product-lists.brand.get' },
  );
});
