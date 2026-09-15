import {
  configurationIdFrom,
  requireConfigurator,
} from '../../../utils/configurator-route';

export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);

  return withErrorHandling(
    () => backend.commit(configurationIdFrom(event), ctx),
    { operation: 'configurator.commit' },
  );
});
