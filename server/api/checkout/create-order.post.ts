import type { CreateOrderOptions, CustomerType } from '@geins/types';
import type { H3Event } from 'h3';
import { checkoutAddressFields } from '#shared/utils/checkout-address';
import { PlaceOrderSchema } from '../../schemas/api-input';
import { getCart } from '../../services/cart';
import { createOrder } from '../../services/checkout';
import { requireAuth } from '../../utils/auth';
import { createOrderRateLimiter, getClientIp } from '../../utils/rate-limiter';

/**
 * Reject an order for a cart the platform reports as having no lines.
 *
 * Fail-open on purpose: only a cart read that positively returns a list of
 * zero lines rejects. A missing field or a failed read places the order as
 * before — blocking a paying customer on a transient read error is worse than
 * the empty order this guards against.
 */
async function rejectEmptyCart(cartId: string, event: H3Event): Promise<void> {
  let items: unknown;
  try {
    items = (await getCart(cartId, event))?.items;
  } catch (error) {
    logger.warn('Cart read before order creation failed; order not blocked', {
      cartId,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (Array.isArray(items) && items.length === 0) {
    throw createAppError(ErrorCode.EMPTY_CART, 'Cart has no items', { cartId });
  }
}

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
      await rejectEmptyCart(body.cartId, event);

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
          customerOrderNumber: body.customerOrderNumber,
          goodsLabel: body.goodsLabel,
          desiredDeliveryDate: (() => {
            if (!body.desiredDeliveryDate) return undefined;
            const d = new Date(body.desiredDeliveryDate);
            if (isNaN(d.getTime())) {
              throw createAppError(
                ErrorCode.BAD_REQUEST,
                'Invalid desiredDeliveryDate',
              );
            }
            return d;
          })(),
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
