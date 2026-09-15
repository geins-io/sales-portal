import {
  configurationIdFrom,
  requireConfigurator,
} from '../../utils/configurator-route';

export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);

  return withErrorHandling(() => backend.get(configurationIdFrom(event), ctx), {
    operation: 'configurator.get',
  });
});
