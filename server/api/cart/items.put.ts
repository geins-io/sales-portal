import { CartUpdateItemSchema } from '../../schemas/api-input';
import { updateItem } from '../../services/cart';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, CartUpdateItemSchema.parse);

  return withErrorHandling(
    async () => {
      return await updateItem(
        body.cartId,
        { itemId: body.itemId, quantity: body.quantity },
        event,
      );
    },
    { operation: 'cart.updateItem' },
  );
});
