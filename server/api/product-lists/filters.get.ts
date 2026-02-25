import { ProductListSchema } from '../../schemas/api-input';
import { getFilters } from '../../services/product-lists';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const validated = ProductListSchema.parse(query);

  return withErrorHandling(
    async () => {
      return await getFilters(validated, event);
    },
    { operation: 'product-lists.filters.get' },
  );
});
