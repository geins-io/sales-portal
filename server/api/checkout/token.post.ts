import type { GenerateCheckoutTokenOptions } from '@geins/types';
import { CheckoutTokenSchema } from '../../schemas/api-input';
import { createToken } from '../../services/checkout';
import { HOSTED_CHECKOUT_BASE_URL } from '#shared/constants/checkout';

export default defineEventHandler(async (event) => {
  const { cartId } = await readValidatedBody(event, CheckoutTokenSchema.parse);

  return withErrorHandling(
    async () => {
      const tenantConfig = event.context.tenant?.config;
      const colors = tenantConfig?.theme?.colors;
      const branding = tenantConfig?.branding;
      const requestUrl = getRequestURL(event);
      const origin = `${requestUrl.protocol}//${requestUrl.host}`;

      const options: GenerateCheckoutTokenOptions = {
        cartId,
        redirectUrls: {
          success: `${origin}/order-confirmation`,
          cancel: `${origin}/cart`,
          terms: `${origin}/terms`,
          continue: `${origin}/`,
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
