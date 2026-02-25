import { SearchProductsSchema } from '../../schemas/api-input';
import { searchProducts } from '../../services/search';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const validated = SearchProductsSchema.parse(query);

  return withErrorHandling(
    async () => {
      const filter: Record<string, unknown> = {
        ...validated.filter,
        searchText: validated.query,
      };
      if (validated.skip !== undefined) filter.skip = validated.skip;
      if (validated.take !== undefined) filter.take = validated.take;

      return searchProducts({ filter }, event);
    },
    { operation: 'search.products.get' },
  );
});
