import type { H3Event } from 'h3';
import { ProductAliasSchema } from '../../../schemas/api-input';
import {
  mayHaveConfigurableProducts,
  withConfigurableFlags,
} from '../../../services/configurator';
import {
  getProductsByIds,
  getRelatedProducts,
} from '../../../services/products';
import { logger } from '../../../utils/logger';

// The related query's item type carries neither `productId` nor `type`.
type RelatedRow = {
  productId?: number;
  skus?: { productId?: number | null }[] | null;
};
type ProductTypes = {
  products: { productId: number; type?: string | null }[];
};

function withProductId<T extends RelatedRow>(row: T): T {
  const productId = row.skus?.[0]?.productId;
  return productId == null ? row : { ...row, productId };
}

/** Never throws: without the types, the list renders unflagged. */
async function productTypes(
  productIds: number[],
  userToken: string | undefined,
  event: H3Event,
): Promise<ReadonlyMap<number | undefined, string | null | undefined> | null> {
  try {
    const result = (await getProductsByIds(
      { productIds, userToken },
      event,
    )) as ProductTypes;
    return new Map(result.products.map((p) => [p.productId, p.type]));
  } catch {
    logger.warn('[configurator] related product types unavailable');
    return null;
  }
}

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const { alias: validatedAlias } = ProductAliasSchema.parse({ alias });
  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      const related = await getRelatedProducts(
        { alias: validatedAlias, userToken: auth?.authToken },
        event,
      );
      if (!Array.isArray(related)) return related;

      const rows = (related as RelatedRow[]).map(withProductId);
      const productIds = rows.flatMap((row) => row.productId ?? []);
      if (
        productIds.length === 0 ||
        !(await mayHaveConfigurableProducts(event))
      ) {
        return rows;
      }

      const types = await productTypes(productIds, auth?.authToken, event);
      if (!types) return rows;
      return withConfigurableFlags(
        event,
        rows.map((row) => ({ ...row, type: types.get(row.productId) })),
      );
    },
    { operation: 'products.related.get' },
  );
});
