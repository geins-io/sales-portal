import type { CreateOrderOptions, CustomerType } from '@geins/types';
import { checkoutAddressFields } from '#shared/utils/checkout-address';
import { PlaceOrderSchema } from '../../schemas/api-input';
import { createOrder } from '../../services/checkout';
import { requireAuth } from '../../utils/auth';
import { createOrderRateLimiter, getClientIp } from '../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  if (event.context.tenant?.config?.mode === 'catalog') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Not available in catalogue mode',
    });
  }

  await requireAuth(event);

  const ip = getClientIp(event);
  const { allowed } = await createOrderRateLimiter.check(ip);
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many order attempts');
  }

  const body = await readValidatedBody(event, PlaceOrderSchema.parse);

  return withErrorHandling(
    async () => {
      // @geins/types doesn't yet expose billingAddressId / shippingAddressId
      // on CheckoutInputType, but the live Geins GraphQL schema accepts
      // both (verified via introspection — required for company / B2B
      // checkout). Build the options object loosely and cast at the
      // boundary so TS doesn't reject the supported fields.
      const options: CreateOrderOptions = {
        cartId: body.cartId,
        checkoutOptions: {
          paymentId: body.paymentId,
          shippingId: body.shippingId,
          email: body.email,
          identityNumber: body.identityNumber,
          message: body.message,
          acceptedConsents: body.acceptedConsents,
          customerType: body.customerType as CustomerType | undefined,
          ...checkoutAddressFields(
            'billing',
            body.billingAddress,
            body.billingAddressId,
          ),
          ...checkoutAddressFields(
            'shipping',
            body.shippingAddress,
            body.shippingAddressId,
          ),
        } as CreateOrderOptions['checkoutOptions'],
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
