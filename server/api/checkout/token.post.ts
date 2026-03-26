import { createHmac, randomBytes } from 'node:crypto';
import { CheckoutTokenSchema } from '../../schemas/api-input';
import { requireAuth } from '../../utils/auth';
import { HOSTED_CHECKOUT_BASE_URL } from '#shared/constants/checkout';

/** Token validity window in seconds (1 hour). */
const TOKEN_TTL_SECONDS = 60 * 60;

interface BrandingStyles {
  primaryColor: string;
  primaryForegroundColor: string;
  secondaryColor: string;
  secondaryForegroundColor: string;
  backgroundColor: string;
  foregroundColor: string;
  radius?: string | null;
  logoUrl?: string | null;
  brandName?: string;
}

interface TokenPayload {
  jti: string;
  tenantId: string;
  cartId: string;
  iat: number;
  exp: number;
  branding: BrandingStyles;
}

function encodeBase64Url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildToken(payload: TokenPayload, secret: string): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = createHmac('sha256', secret || 'fallback-dev-secret')
    .update(signingInput)
    .digest('base64url');
  return `${signingInput}.${signature}`;
}

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const body = await readValidatedBody(event, CheckoutTokenSchema.parse);

  return withErrorHandling(
    async () => {
      const tenantConfig = event.context.tenant?.config;
      const colors = tenantConfig?.theme?.colors ?? {};
      const branding = tenantConfig?.branding;

      const brandingStyles: BrandingStyles = {
        primaryColor: (colors.primary as string) ?? '',
        primaryForegroundColor: (colors.primaryForeground as string) ?? '',
        secondaryColor: (colors.secondary as string) ?? '',
        secondaryForegroundColor: (colors.secondaryForeground as string) ?? '',
        backgroundColor: (colors.background as string) ?? '',
        foregroundColor: (colors.foreground as string) ?? '',
        radius: tenantConfig?.theme?.radius ?? null,
        logoUrl: branding?.logoUrl ?? null,
        brandName: branding?.name,
      };

      const now = Math.floor(Date.now() / 1000);
      const payload: TokenPayload = {
        jti: randomBytes(16).toString('hex'),
        tenantId:
          tenantConfig?.tenantId ?? event.context.tenant?.tenantId ?? '',
        cartId: body.cartId,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
        branding: brandingStyles,
      };

      const signingSecret =
        process.env.NUXT_WEBHOOK_SECRET || 'fallback-dev-secret';
      const token = buildToken(payload, signingSecret);
      const checkoutUrl = `${HOSTED_CHECKOUT_BASE_URL}?token=${token}&cartId=${encodeURIComponent(body.cartId)}`;

      return { token, checkoutUrl };
    },
    { operation: 'checkout.generateToken' },
  );
});
