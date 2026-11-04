import { GetCheckoutSchema } from '../../schemas/api-input';
import { getCheckout } from '../../services/checkout';
import { sessionForFeature } from '../../utils/feature-access';

export default defineEventHandler(async (event) => {
  await sessionForFeature(event, 'orderPlacement');

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
