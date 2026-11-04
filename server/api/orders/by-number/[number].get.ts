import * as ordersService from '../../../services/orders';
import { sessionForFeature } from '../../../utils/feature-access';
import { OrderNumberSchema } from '../../../schemas/api-input';

/** The order a quotation became, by the number the quotation carries. */
export default defineEventHandler(async (event) => {
  await sessionForFeature(event, 'orderPlacement');
  const { number } = await getValidatedRouterParams(
    event,
    OrderNumberSchema.parse,
  );
  return withErrorHandling(
    async () => {
      const order = await ordersService.getOrderByNumber(number, event);
      if (!order) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Order not found');
      }
      // Only on success: a cached 404 would come back on the page's next poll.
      setResponseHeader(
        event,
        'Cache-Control',
        'private, max-age=30, must-revalidate',
      );
      return { order };
    },
    { operation: 'orders.getByNumber' },
  );
});
