import { CartDeleteItemSchema } from '../../schemas/api-input';
import { deleteItem } from '../../services/cart';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { cartId, itemId } = CartDeleteItemSchema.parse(query);

  return withErrorHandling(
    async () => {
      return await deleteItem(cartId, itemId, event);
    },
    { operation: 'cart.deleteItem' },
  );
});
