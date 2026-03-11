import { GetCheckoutSchema } from '../../schemas/api-input';
import { getCheckout } from '../../services/checkout';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const { cartId } = await getValidatedQuery(event, GetCheckoutSchema.parse);

  return withErrorHandling(
    async () => {
      const checkout = await getCheckout({ cartId }, event);

      if (!checkout) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Checkout not found');
      }

      return checkout;
    },
    { operation: 'checkout.get' },
  );
});
