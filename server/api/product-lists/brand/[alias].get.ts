import { ListPageSchema } from '../../../schemas/api-input';
import { getBrandPage } from '../../../services/product-lists';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ListPageSchema.parse({ alias });

  return withErrorHandling(
    async () => {
      const page = await getBrandPage({ alias: validatedAlias }, event);

      if (!page) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Brand page not found');
      }

      return page;
    },
    { operation: 'product-lists.brand.get' },
  );
});
