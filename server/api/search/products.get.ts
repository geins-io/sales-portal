import { SearchProductsSchema } from '../../schemas/api-input';
import { withConfigurableFlags } from '../../services/configurator';
import { searchProducts } from '../../services/search';

type SearchResult = {
  products?: { productId?: number; type?: string | null }[] | null;
} | null;

export default defineEventHandler(async (event) => {
  const validated = await getValidatedQuery(event, SearchProductsSchema.parse);
  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      const filter: Record<string, unknown> = {
        ...validated.filter,
        searchText: validated.query,
      };

      const result = (await searchProducts(
        {
          filter,
          skip: validated.skip,
          take: validated.take,
          userToken: auth?.authToken,
        },
        event,
      )) as SearchResult;
      return result?.products
        ? { ...result, products: withConfigurableFlags(event, result.products) }
        : result;
    },
    { operation: 'search.products.get' },
  );
});
