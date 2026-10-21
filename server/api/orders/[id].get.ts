import * as ordersService from '../../services/orders';
import { requireAuth } from '../../utils/auth';
import { OrderIdSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const { id: validatedId } = OrderIdSchema.parse({ id });
  return withErrorHandling(
    async () => {
      const order = await ordersService.getOrder(
        { publicOrderId: validatedId },
        event,
      );
      if (!order) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Order not found');
      }
      // Only on success: a cached error would come back on the next read.
      setResponseHeader(
        event,
        'Cache-Control',
        'private, max-age=30, must-revalidate',
      );
      return { order };
    },
    { operation: 'orders.get' },
  );
});
