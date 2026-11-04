import { ValidateOrderSchema } from '../../schemas/api-input';
import { validateOrder } from '../../services/checkout';
import { sessionForFeature } from '../../utils/feature-access';
import { assertCommerceMode } from '../../utils/catalog-mode';

export default defineEventHandler(async (event) => {
  assertCommerceMode(event);

  await sessionForFeature(event, 'orderPlacement');

  const body = await readValidatedBody(event, ValidateOrderSchema.parse);

  return withErrorHandling(
    async () => {
      return await validateOrder(
        { cartId: body.cartId, checkoutOptions: { email: body.email } },
        event,
      );
    },
    { operation: 'checkout.validate' },
  );
});
