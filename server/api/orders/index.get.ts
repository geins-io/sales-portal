import * as ordersService from '../../services/orders';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  setResponseHeader(
    event,
    'Cache-Control',
    'private, max-age=30, must-revalidate',
  );
  return withErrorHandling(
    async () => {
      const result = await ordersService.listOrders(event);
      return result;
    },
    { operation: 'orders.list' },
  );
});
