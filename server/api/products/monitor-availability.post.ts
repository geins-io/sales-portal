import { MonitorAvailabilitySchema } from '../../schemas/api-input';
import { monitorAvailability } from '../../services/products';

export default defineEventHandler(async (event) => {
  const validated = await readValidatedBody(event, (raw) =>
    MonitorAvailabilitySchema.parse(raw),
  );

  return withErrorHandling(
    async () => {
      return monitorAvailability(validated, event);
    },
    { operation: 'products.monitorAvailability.post' },
  );
});
