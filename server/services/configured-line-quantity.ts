import { createAppError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';
import type { ConfiguratorBackend, ConfiguratorContext } from './configurator';

/**
 * A configured line at a new quantity, as the platform prices one: reopened,
 * the quantity changed in the session, committed, and swapped onto the same
 * line. Until the swap the line is as it was, so a failure leaves it untouched.
 */
export async function changeConfiguredQuantity(
  backend: ConfiguratorBackend,
  cartId: string,
  itemId: string,
  quantity: number,
  ctx: ConfiguratorContext,
): Promise<void> {
  const { configurationId } = await backend.reopen(cartId, itemId, ctx);
  let committedConfigurationId: string;
  try {
    const changed = await backend.applyChanges(
      configurationId,
      [{ type: 'quantity', quantity }],
      ctx,
    );
    if (!changed.isValid) {
      throw createAppError(
        ErrorCode.VALIDATION_ERROR,
        'The configuration is not valid at that quantity',
      );
    }
    ({ committedConfigurationId } = await backend.commit(configurationId, ctx));
  } catch (error) {
    await backend.release(configurationId, ctx).catch(() => {
      logger.warn(
        '[configurator] a quantity change could not release its session',
      );
    });
    throw error;
  }
  // The commit ended the session, so there is nothing left to release.
  try {
    await backend.replaceLine(
      cartId,
      itemId,
      committedConfigurationId,
      ctx,
      quantity,
    );
  } catch (error) {
    logger.warn(
      '[configurator] a quantity change committed but could not swap the line',
    );
    throw error;
  }
}
