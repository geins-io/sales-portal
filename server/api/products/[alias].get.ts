import { ProductAliasSchema } from '../../schemas/api-input';
import { getProduct } from '../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ProductAliasSchema.parse({ alias });

  return withErrorHandling(
    async () => {
      const product = await getProduct({ alias: validatedAlias }, event);
      if (!product) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Product not found');
      }
      return product;
    },
    { operation: 'products.get' },
  );
});
