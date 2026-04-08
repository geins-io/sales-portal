import * as userService from '../../services/user';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const { authToken } = await requireAuth(event);
  setResponseHeader(
    event,
    'Cache-Control',
    'private, max-age=30, must-revalidate',
  );
  const data = await userService.getUserOrders(authToken, event);

  return { orders: data?.getOrders ?? [] };
});
