import * as ordersService from '../../services/orders';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  return withErrorHandling(
    async () => {
      const result = await ordersService.listOrders(event);
      // Only on success: a cached error would come back to the page's retry.
      setResponseHeader(
        event,
        'Cache-Control',
        'private, max-age=30, must-revalidate',
      );
      return result;
    },
    { operation: 'orders.list' },
  );
});
