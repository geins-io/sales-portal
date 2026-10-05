import { ReplayOrderLineSchema } from '../../schemas/api-input';
import { replayOrderLine } from '../../services/configurator-replay';
import { requireConfigurator } from '../../utils/configurator-route';

/** A new session holding a configured order row's choices, when they still fit. */
export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);
  const input = await readValidatedBody(event, ReplayOrderLineSchema.parse);

  return withErrorHandling(() => replayOrderLine(backend, input, ctx), {
    operation: 'configurator.fromOrder',
  });
});
