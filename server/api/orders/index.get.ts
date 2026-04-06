import * as ordersService from '../../services/orders';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  return withErrorHandling(
    async () => {
      const result = await ordersService.listOrders(event);
      return result;
    },
    { operation: 'orders.list' },
  );
});
