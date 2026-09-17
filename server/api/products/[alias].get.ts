import type { CategoryNode } from '#shared/utils/breadcrumb-trail';
import { ancestorsFromCategories } from '#shared/utils/breadcrumb-trail';
import { ProductAliasSchema } from '../../schemas/api-input';
import { isConfigurableProduct } from '../../services/configurator';
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
        // Don't let the CDN cache the 404. A freshly-published product would
        // otherwise stay 404 for the s-maxage window on every edge.
        setResponseHeader(event, 'Cache-Control', 'no-store');
        throw createAppError(ErrorCode.NOT_FOUND, 'Product not found');
      }
      // The trail follows the PRIMARY category, walked out of the category
      // closure this same response already carries — no second round trip. The
      // list page has no such payload and resolves its ancestors by alias
      // instead; the asymmetry is deliberate, see docs on the two helpers.
      // `categories` is destructured off rather than passed on: nothing
      // client-side reads it, and it is 339 B on the smallest tenant measured,
      // 909 B on the largest.
      const { categories, ...withoutClosure } = product as {
        productId?: number;
        primaryCategory?: { categoryId?: number };
        categories?: (CategoryNode | null)[];
        texts?: { text1?: string; text2?: string; text3?: string };
      } & Record<string, unknown>;

      const ancestors = ancestorsFromCategories(
        categories,
        withoutClosure.primaryCategory?.categoryId,
      );

      // The portal-side name for a product the configurator stands behind; the
      // question goes to the seam, which is the one place that changes when the
      // merchant API carries a field of its own. Spread only when true, so an
      // ordinary product's response is what it was before the configurator.
      const configurable = isConfigurableProduct(
        event,
        String(withoutClosure.productId),
      );

      return {
        ...sanitizeProductTexts(withoutClosure),
        ancestors,
        ...(configurable ? { configurable } : {}),
      };
    },
    { operation: 'products.get' },
  );
});
