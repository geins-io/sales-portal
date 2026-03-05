import { MonitorAvailabilitySchema } from '../../schemas/api-input';
import { monitorAvailability } from '../../services/products';

export default defineEventHandler(async (event) => {
  const validated = await readValidatedBody(event, (raw) =>
    MonitorAvailabilitySchema.parse(raw),
  );

  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      return monitorAvailability(
        { ...validated, userToken: auth?.authToken },
        event,
      );
    },
    { operation: 'products.monitorAvailability.post' },
  );
});
