import { ProductAliasSchema } from '../../../schemas/api-input';
import { getRelatedProducts } from '../../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ProductAliasSchema.parse({ alias });

  return withErrorHandling(
    async () => {
      return getRelatedProducts({ alias: validatedAlias }, event);
    },
    { operation: 'products.related.get' },
  );
});
