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
        throw createAppError(ErrorCode.NOT_FOUND, 'Category page not found');
      }

      return page;
    },
    { operation: 'product-lists.category.get' },
  );
});
