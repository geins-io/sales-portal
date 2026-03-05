import { ProductAliasSchema } from '../../../schemas/api-input';
import { getPriceHistory } from '../../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ProductAliasSchema.parse({ alias });
  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      return getPriceHistory(
        { alias: validatedAlias, userToken: auth?.authToken },
        event,
      );
    },
    { operation: 'products.priceHistory.get' },
  );
});
