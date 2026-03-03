import * as userService from '../../services/user';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const { authToken } = await requireAuth(event);
  const data = await userService.getUserOrders(authToken, event);

  return { orders: data?.getOrders ?? [] };
});
