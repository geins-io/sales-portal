import * as ordersService from '../../services/orders';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Order ID is required');
  }
  return withErrorHandling(
    async () => {
      const order = await ordersService.getOrder({ publicOrderId: id }, event);
      if (!order) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Order not found');
      }
      return { order };
    },
    { operation: 'orders.get' },
  );
});
