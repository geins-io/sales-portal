import { ProductAliasSchema } from '../../../schemas/api-input';
import { getRelatedProducts } from '../../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ProductAliasSchema.parse({ alias });
  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      return getRelatedProducts(
        { alias: validatedAlias, userToken: auth?.authToken },
        event,
      );
    },
    { operation: 'products.related.get' },
  );
});
