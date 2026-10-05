import { CartLineRefSchema } from '../../../schemas/api-input';
import { getCart } from '../../../services/cart';
import {
  configurationIdFrom,
  requireConfigurator,
} from '../../../utils/configurator-route';
import { logger } from '../../../utils/logger';

/**
 * Puts the committed configuration `:id` on a configured line, which keeps its
 * id: the edit's counterpart of the add.
 */
export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);
  const committedConfigurationId = configurationIdFrom(event);
  const { cartId, itemId } = await readValidatedBody(
    event,
    CartLineRefSchema.parse,
  );

  const line = await withErrorHandling(
    () => backend.replaceLine(cartId, itemId, committedConfigurationId, ctx),
    { operation: 'configurator.replaceLine' },
  );

  // The line is swapped. A failed read answered as a failed swap would leave
  // the buyer told their line kept its old choices when it did not.
  try {
    return { cart: await getCart(cartId, event), itemId: line.itemId };
  } catch {
    logger.warn('[configurator] cart read failed after a configured swap');
    return { cart: null, itemId: line.itemId };
  }
});
