import { createCart } from '../../services/cart';
import { assertCommerceMode } from '../../utils/catalog-mode';
import { rememberCart } from '../../utils/cart-owner';

export default defineEventHandler(async (event) => {
  assertCommerceMode(event);

  return withErrorHandling(
    async () => {
      const cart = await createCart(event);
      rememberCart(event, getSessionToken(event), cart.id);
      return cart;
    },
    { operation: 'cart.create' },
  );
});
