import { ProductAliasSchema } from '../../schemas/api-input';
import { getProduct } from '../../services/products';
import { sanitizeWidgetHtml } from '../../utils/cms-sanitize';

function sanitizeProductTexts<
  T extends { texts?: { text1?: string; text2?: string; text3?: string } },
>(product: T): T {
  if (!product.texts) return product;

  const texts = { ...product.texts };
  for (const key of ['text1', 'text2', 'text3'] as const) {
    if (typeof texts[key] === 'string') {
      texts[key] = sanitizeWidgetHtml(texts[key]);
    }
  }
  return { ...product, texts };
}

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ProductAliasSchema.parse({ alias });
  const auth = await optionalAuth(event);

  setResponseHeader(
    event,
    'Cache-Control',
    auth?.authToken
      ? 'private, no-cache'
      : 'public, s-maxage=60, stale-while-revalidate=600',
  );

  return withErrorHandling(
    async () => {
      const product = await getProduct(
        { alias: validatedAlias, userToken: auth?.authToken },
        event,
      );
      if (!product) {
        // Don't let the CDN cache the 404 — a freshly-published product would
        // otherwise stay 404 for the s-maxage window on every edge.
        setResponseHeader(event, 'Cache-Control', 'no-store');
        throw createAppError(ErrorCode.NOT_FOUND, 'Product not found');
      }
      return sanitizeProductTexts(product);
    },
    { operation: 'products.get' },
  );
});
