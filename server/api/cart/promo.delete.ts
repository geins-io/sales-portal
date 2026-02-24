import { CartIdSchema } from '../../schemas/api-input';
import { removePromoCode } from '../../services/cart';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { cartId } = CartIdSchema.parse(query);

  return withErrorHandling(
    async () => {
      return await removePromoCode(cartId, event);
    },
    { operation: 'cart.removePromoCode' },
  );
});
