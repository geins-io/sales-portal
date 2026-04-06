import * as purchasedProductsService from '../../services/purchased-products';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const { authToken } = await requireAuth(event);
  return withErrorHandling(
    async () => {
      return await purchasedProductsService.getPurchasedProducts(
        authToken,
        event,
      );
    },
    { operation: 'orders.products' },
  );
});
