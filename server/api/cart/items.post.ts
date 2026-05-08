import { CartAddItemSchema } from '../../schemas/api-input';
import { addItem } from '../../services/cart';

export default defineEventHandler(async (event) => {
  if (event.context.tenant?.config?.mode === 'catalog') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Not available in catalogue mode',
    });
  }

  const body = await readValidatedBody(event, CartAddItemSchema.parse);

  return withErrorHandling(
    async () => {
      return await addItem(
        body.cartId,
        { skuId: body.skuId, quantity: body.quantity },
        event,
      );
    },
    { operation: 'cart.addItem' },
  );
});
