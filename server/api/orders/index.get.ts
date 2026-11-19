import * as ordersService from '../../services/orders';
import { ListOrdersSchema } from '../../schemas/api-input';
import { requireAuth } from '../../utils/auth';

/** One page of the order list. */
export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const query = await getValidatedQuery(event, ListOrdersSchema.parse);
  return withErrorHandling(
    async () => {
      const result = await ordersService.listOrders(query, event);
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
