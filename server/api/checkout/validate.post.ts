import { ValidateOrderSchema } from '../../schemas/api-input';
import { validateOrder } from '../../services/checkout';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  if (event.context.tenant?.config?.mode === 'catalog') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Not available in catalogue mode',
    });
  }

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
