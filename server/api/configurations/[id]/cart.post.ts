import { ConfiguredCartItemSchema } from '../../../schemas/api-input';
import { addItem, getCart } from '../../../services/cart';
import {
  configurationIdFrom,
  requireConfigurator,
} from '../../../utils/configurator-route';
import { logger } from '../../../utils/logger';

/** `:id` is the committed configuration's id, not the session's. */
export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);
  const committedConfigurationId = configurationIdFrom(event);
  const { cartId, skuId, quantity } = await readValidatedBody(
    event,
    ConfiguredCartItemSchema.parse,
  );

  const { itemId } = await withErrorHandling(
    () =>
      backend.addToCart(
        cartId,
        { committedConfigurationId, skuId, quantity },
        {
          ...ctx,
          cart: {
            addPlainItem: (id, item) => addItem(id, item, event),
          },
        },
      ),
    { operation: 'configurator.addToCart' },
  );

  // The line is in. A failed read answered as a failed add would be retried,
  // and the retry would add the same committed id again: two lines.
  try {
    return { cart: await getCart(cartId, event), itemId };
  } catch {
    logger.warn('[configurator] cart read failed after a configured add');
    return { cart: null, itemId };
  }
});
