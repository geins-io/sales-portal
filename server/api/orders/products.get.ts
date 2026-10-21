import * as purchasedProductsService from '../../services/purchased-products';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  return withErrorHandling(
    async () => {
      const result = await purchasedProductsService.getPurchasedProducts(event);
      // Only on success: a cached error would come back to the page's retry.
      setResponseHeader(
        event,
        'Cache-Control',
        'private, max-age=300, must-revalidate',
      );
      return result;
    },
    { operation: 'orders.products' },
  );
});
