import { CartLineRefSchema } from '../../schemas/api-input';
import { requireConfigurator } from '../../utils/configurator-route';

/** A new session from a configured cart line; the line itself is untouched. */
export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);
  const { cartId, itemId } = await readValidatedBody(
    event,
    CartLineRefSchema.parse,
  );

  return withErrorHandling(() => backend.reopen(cartId, itemId, ctx), {
    operation: 'configurator.reopen',
  });
});
