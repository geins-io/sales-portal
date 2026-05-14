import * as purchasedProductsService from '../../services/purchased-products';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  setResponseHeader(
    event,
    'Cache-Control',
    'private, max-age=300, must-revalidate',
  );
  return withErrorHandling(
    async () => {
      return await purchasedProductsService.getPurchasedProducts(event);
    },
    { operation: 'orders.products' },
  );
});
