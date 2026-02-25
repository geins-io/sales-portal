import { CartPromoCodeSchema } from '../../schemas/api-input';
import { applyPromoCode } from '../../services/cart';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, CartPromoCodeSchema.parse);

  return withErrorHandling(
    async () => {
      return await applyPromoCode(body.cartId, body.promoCode, event);
    },
    { operation: 'cart.applyPromoCode' },
  );
});
