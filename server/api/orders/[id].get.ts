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
      return { order };
    },
    { operation: 'orders.get' },
  );
});
