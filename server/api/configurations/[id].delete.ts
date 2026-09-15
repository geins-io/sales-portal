import {
  configurationIdFrom,
  requireConfigurator,
} from '../../utils/configurator-route';

export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);

  await withErrorHandling(
    () => backend.release(configurationIdFrom(event), ctx),
    { operation: 'configurator.release' },
  );

  // h3 answers a null return with a bare 204.
  return null;
});
