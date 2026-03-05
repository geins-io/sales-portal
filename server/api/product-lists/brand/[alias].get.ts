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
        throw createAppError(ErrorCode.NOT_FOUND, 'Brand page not found');
      }

      return page;
    },
    { operation: 'product-lists.brand.get' },
  );
});
