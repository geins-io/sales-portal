import { CartDeleteItemSchema } from '../../schemas/api-input';
import { deleteItem } from '../../services/cart';
import { assertCommerceMode } from '../../utils/catalog-mode';

export default defineEventHandler(async (event) => {
  assertCommerceMode(event);

  const { cartId, itemId } = await getValidatedQuery(
    event,
    CartDeleteItemSchema.parse,
  );

  return withErrorHandling(
    async () => {
      return await deleteItem(cartId, itemId, event);
    },
    { operation: 'cart.deleteItem' },
  );
});
