import { ValidateOrderSchema } from '../../schemas/api-input';
import { validateOrder } from '../../services/checkout';
import { requireAuth } from '../../utils/auth';
import { assertCommerceMode } from '../../utils/catalog-mode';

export default defineEventHandler(async (event) => {
  assertCommerceMode(event);

  await requireAuth(event);

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
