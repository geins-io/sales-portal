import { ProductAliasSchema } from '../../../schemas/api-input';
import { getPriceHistory } from '../../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ProductAliasSchema.parse({ alias });

  return withErrorHandling(
    async () => {
      return getPriceHistory({ alias: validatedAlias }, event);
    },
    { operation: 'products.priceHistory.get' },
  );
});
