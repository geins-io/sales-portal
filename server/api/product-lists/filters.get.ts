import { ProductListSchema } from '../../schemas/api-input';
import { getFilters } from '../../services/product-lists';

export default defineEventHandler(async (event) => {
  const validated = await getValidatedQuery(event, ProductListSchema.parse);

  return withErrorHandling(
    async () => {
      return await getFilters(validated, event);
    },
    { operation: 'product-lists.filters.get' },
  );
});
