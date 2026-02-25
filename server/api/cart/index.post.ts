import { createCart } from '../../services/cart';

export default defineEventHandler(async (event) => {
  return withErrorHandling(
    async () => {
      return await createCart(event);
    },
    { operation: 'cart.create' },
  );
});
