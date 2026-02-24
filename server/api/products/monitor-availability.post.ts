import { MonitorAvailabilitySchema } from '../../schemas/api-input';
import { monitorAvailability } from '../../services/products';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const validated = MonitorAvailabilitySchema.parse(body);

  return withErrorHandling(
    async () => {
      return monitorAvailability(validated, event);
    },
    { operation: 'products.monitorAvailability.post' },
  );
});
