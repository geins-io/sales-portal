import { ProductListSchema } from '../../schemas/api-input';
import { getProducts } from '../../services/product-lists';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const validated = ProductListSchema.parse(query);

  return withErrorHandling(
    async () => {
      return await getProducts(validated, event);
    },
    { operation: 'product-lists.products.get' },
  );
});
