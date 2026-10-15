import { createCart } from '../../services/cart';
import { assertCommerceMode } from '../../utils/catalog-mode';

export default defineEventHandler(async (event) => {
  assertCommerceMode(event);

  return withErrorHandling(
    async () => {
      return await createCart(event);
    },
    { operation: 'cart.create' },
  );
});
