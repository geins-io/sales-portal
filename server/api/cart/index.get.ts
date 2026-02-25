import { CartIdSchema } from '../../schemas/api-input';
import { getCart } from '../../services/cart';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { cartId } = CartIdSchema.parse(query);

  return withErrorHandling(
    async () => {
      const cart = await getCart(cartId, event);

      if (!cart) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Cart not found');
      }

      return cart;
    },
    { operation: 'cart.get' },
  );
});
