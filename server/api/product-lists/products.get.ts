import { ProductListSchema } from '../../schemas/api-input';
import { getProducts } from '../../services/product-lists';

export default defineEventHandler(async (event) => {
  const validated = await getValidatedQuery(event, ProductListSchema.parse);
  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      return await getProducts(
        { ...validated, userToken: auth?.authToken },
        event,
      );
    },
    { operation: 'product-lists.products.get' },
  );
});
