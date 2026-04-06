import type { CreateOrderOptions, CustomerType } from '@geins/types';
import { PlaceOrderSchema } from '../../schemas/api-input';
import { createOrder } from '../../services/checkout';
import { requireAuth } from '../../utils/auth';
import { createOrderRateLimiter, getClientIp } from '../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const ip = getClientIp(event);
  const { allowed } = await createOrderRateLimiter.check(ip);
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many order attempts');
  }

  const body = await readValidatedBody(event, PlaceOrderSchema.parse);

  return withErrorHandling(
    async () => {
      const options: CreateOrderOptions = {
        cartId: body.cartId,
        checkoutOptions: {
          paymentId: body.paymentId,
          shippingId: body.shippingId,
          email: body.email,
          identityNumber: body.identityNumber,
          message: body.message,
          acceptedConsents: body.acceptedConsents,
          billingAddress: body.billingAddress,
          shippingAddress: body.shippingAddress,
          customerType: body.customerType as CustomerType | undefined,
        },
      };

      const result = await createOrder(options, event);

      if (!result?.created) {
        if (result?.message) {
          console.error('Order creation SDK error:', result.message);
        }
        throw createAppError(ErrorCode.BAD_REQUEST, 'Order creation failed');
      }

      return { orderId: result.orderId, publicId: result.publicId };
    },
    { operation: 'checkout.createOrder' },
  );
});
