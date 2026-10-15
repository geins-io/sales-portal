import { CartUpdateItemSchema } from '../../schemas/api-input';
import { updateItem } from '../../services/cart';
import { assertCommerceMode } from '../../utils/catalog-mode';

export default defineEventHandler(async (event) => {
  assertCommerceMode(event);

  const body = await readValidatedBody(event, CartUpdateItemSchema.parse);

  return withErrorHandling(
    async () => {
      return await updateItem(
        body.cartId,
        { id: body.itemId, quantity: body.quantity },
        event,
      );
    },
    { operation: 'cart.updateItem' },
  );
});
