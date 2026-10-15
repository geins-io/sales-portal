import { CartIdSchema } from '../../schemas/api-input';
import { removePromoCode } from '../../services/cart';
import { assertCommerceMode } from '../../utils/catalog-mode';

export default defineEventHandler(async (event) => {
  assertCommerceMode(event);

  const { cartId } = await getValidatedQuery(event, CartIdSchema.parse);

  return withErrorHandling(
    async () => {
      return await removePromoCode(cartId, event);
    },
    { operation: 'cart.removePromoCode' },
  );
});
