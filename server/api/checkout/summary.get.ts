import { CheckoutSummarySchema } from '../../schemas/api-input';
import { getSummary } from '../../services/checkout';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const { orderId, paymentMethod } = await getValidatedQuery(
    event,
    CheckoutSummarySchema.parse,
  );

  return withErrorHandling(
    async () => {
      const summary = await getSummary({ orderId, paymentMethod }, event);

      if (!summary) {
        throw createAppError(ErrorCode.NOT_FOUND, 'Order summary not found');
      }

      return summary;
    },
    { operation: 'checkout.summary' },
  );
});
