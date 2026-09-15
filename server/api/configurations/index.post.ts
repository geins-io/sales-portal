import { CreateConfigurationSchema } from '../../schemas/api-input';
import { requireConfigurator } from '../../utils/configurator-route';

export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);
  const input = await readValidatedBody(event, CreateConfigurationSchema.parse);

  return withErrorHandling(() => backend.create(input, ctx), {
    operation: 'configurator.create',
  });
});
