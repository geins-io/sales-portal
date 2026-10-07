import { RestoreConfigurationSchema } from '../../schemas/api-input';
import { restoreConfiguration } from '../../services/configurator-replay';
import { requireConfigurator } from '../../utils/configurator-route';

/** A new session holding the choices of one that expired, when they still fit. */
export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);
  const input = await readValidatedBody(
    event,
    RestoreConfigurationSchema.parse,
  );

  return withErrorHandling(() => restoreConfiguration(backend, input, ctx), {
    operation: 'configurator.restore',
  });
});
