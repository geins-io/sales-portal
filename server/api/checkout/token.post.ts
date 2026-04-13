import type { GenerateCheckoutTokenOptions } from '@geins/types';
import { CheckoutTokenSchema } from '../../schemas/api-input';
import { createToken, getCheckout } from '../../services/checkout';
import { HOSTED_CHECKOUT_BASE_URL } from '#shared/constants/checkout';
import { COOKIE_NAMES } from '#shared/constants/storage';

const TWO_LETTER = /^[a-z]{2}$/;

export default defineEventHandler(async (event) => {
  const { cartId } = await readValidatedBody(event, CheckoutTokenSchema.parse);

  return withErrorHandling(
    async () => {
      const tenantConfig = event.context.tenant?.config;
      const colors = tenantConfig?.theme?.colors;
      const branding = tenantConfig?.branding;
      const requestUrl = getRequestURL(event);
      const origin = `${requestUrl.protocol}//${requestUrl.host}`;

      // The hosted-checkout redirect URLs must preserve the user's current
      // locale/market so post-payment landings don't bounce through
      // middleware. API routes skip plugin 01 resolution, so read the short
      // codes straight from the cookies set by plugin 00.
      const marketCookie = getCookie(event, COOKIE_NAMES.MARKET);
      const localeCookie = getCookie(event, COOKIE_NAMES.LOCALE);
      const prefix =
        marketCookie &&
        localeCookie &&
        TWO_LETTER.test(marketCookie) &&
        TWO_LETTER.test(localeCookie)
          ? `/${marketCookie}/${localeCookie}`
          : '';

      // Fetch checkout to discover available payment/shipping methods
      const checkout = await getCheckout({ cartId }, event);

      const defaultPayment =
        checkout?.paymentOptions?.find((o) => o.isDefault || o.isSelected) ??
        checkout?.paymentOptions?.[0];
      const defaultShipping =
        checkout?.shippingOptions?.find((o) => o.isDefault || o.isSelected) ??
        checkout?.shippingOptions?.[0];

      const options: GenerateCheckoutTokenOptions = {
        cartId,
        selectedPaymentMethodId: defaultPayment?.id,
        selectedShippingMethodId: defaultShipping?.id,
        redirectUrls: {
          // Geins substitutes {geins.cartid} at redirect time. The cartId
          // becomes the orderId post-payment, matching our /[id].vue route.
          success: `${origin}${prefix}/order-confirmation/{geins.cartid}?geins-pm={geins.paymentMethodId}&geins-pt={geins.paymentType}&geins-uid={payment.uid}`,
          cancel: `${origin}${prefix}/cart`,
          continue: `${origin}${prefix}/`,
        },
        branding: {
          title: branding?.name ?? undefined,
          logo: branding?.logoUrl ?? undefined,
          styles: colors
            ? {
                accent: colors.primary as string,
                accentForeground: colors.primaryForeground as string,
                background: colors.background as string,
                foreground: colors.foreground as string,
                card: colors.card as string,
                cardForeground: colors.cardForeground as string,
                border: colors.border as string,
                radius: tenantConfig?.theme?.radius ?? undefined,
              }
            : undefined,
        },
      };

      const token = await createToken(options, event);

      if (!token) {
        throw createAppError(
          ErrorCode.BAD_REQUEST,
          'Failed to generate checkout token',
        );
      }

      return {
        token,
        checkoutUrl: `${HOSTED_CHECKOUT_BASE_URL}/${token}`,
      };
    },
    { operation: 'checkout.generateToken' },
  );
});
