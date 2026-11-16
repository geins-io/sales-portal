import type { GenerateCheckoutTokenOptions } from '@geins/types';
import { CheckoutTokenSchema } from '../../schemas/api-input';
import { createToken, getCheckout } from '../../services/checkout';
import { HOSTED_CHECKOUT_BASE_URL } from '#shared/constants/checkout';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { assertCommerceMode } from '../../utils/catalog-mode';
import { getRequestedLocale } from '../../utils/locale';

const TWO_LETTER = /^[a-z]{2}$/;

export default defineEventHandler(async (event) => {
  assertCommerceMode(event);

  const { cartId } = await readValidatedBody(event, CheckoutTokenSchema.parse);

  return withErrorHandling(
    async () => {
      const tenantConfig = event.context.tenant?.config;
      const colors = tenantConfig?.theme?.colors;
      const branding = tenantConfig?.branding;
      const requestUrl = getRequestURL(event);
      const origin = `${requestUrl.protocol}//${requestUrl.host}`;

      // The hosted-checkout redirect URLs return to the language of the page
      // that asked, so post-payment landings don't bounce through middleware.
      // The market is the cookie's, as everywhere on the API side.
      const market = getCookie(event, COOKIE_NAMES.MARKET);
      const locale = getRequestedLocale(event);
      const prefix =
        market && locale && TWO_LETTER.test(market)
          ? `/${market}/${locale}`
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
          // Geins auto-appends ?geins-cart={cartid}&geins-pm=...&geins-pt=...
          // &geins-uid=... to the success URL. The confirmation page reads
          // `geins-cart` from the query to resolve the order summary.
          success: `${origin}${prefix}/order-confirmation`,
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
