import { ConfigurationChangesSchema } from '../../../schemas/api-input';
import {
  configurationIdFrom,
  requireConfigurator,
} from '../../../utils/configurator-route';

export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);
  const id = configurationIdFrom(event);
  const { changes } = await readValidatedBody(
    event,
    ConfigurationChangesSchema.parse,
  );

  return withErrorHandling(() => backend.applyChanges(id, changes, ctx), {
    operation: 'configurator.applyChanges',
  });
});
