import { SearchProductsSchema } from '../../schemas/api-input';
import { searchProducts } from '../../services/search';

export default defineEventHandler(async (event) => {
  const validated = await getValidatedQuery(event, SearchProductsSchema.parse);
  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      const filter: Record<string, unknown> = {
        ...validated.filter,
        searchText: validated.query,
      };

      return searchProducts(
        {
          filter,
          skip: validated.skip,
          take: validated.take,
          userToken: auth?.authToken,
        },
        event,
      );
    },
    { operation: 'search.products.get' },
  );
});
