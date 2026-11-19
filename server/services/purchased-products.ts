import type { H3Event } from 'h3';
import { OrderError } from '@geins/core';
import type {
  LatestProductOrder,
  PurchasedProduct,
  PurchasedProductCard,
  PurchasedProductsOverview,
} from '#shared/types/commerce';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';
import { getCompany } from './company';
import { configurableCheck } from './configurator';
import { getCatalogueProducts, type CatalogueProduct } from './products';

interface RawOrder {
  id?: number | string | null;
  publicId?: string | null;
  createdAt?: string | null;
  customerEmail?: string | null;
  billingAddress?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  cart?: {
    items?: RawOrderItem[] | null;
  } | null;
}

interface RawOrderItem {
  skuId?: number | null;
  quantity?: number | null;
  unitPrice?: {
    sellingPriceExVat?: number | null;
    sellingPriceExVatFormatted?: string | null;
    sellingPriceIncVat?: number | null;
    sellingPriceIncVatFormatted?: string | null;
  } | null;
  product?: {
    productId?: number | null;
    type?: string | null;
    articleNumber?: string | null;
    name?: string | null;
    alias?: string | null;
  } | null;
}

/** The start page shows this many of the newest purchased products. */
const OVERVIEW_PRODUCTS = 4;

/**
 * Reads the company's whole order history through one of the purchased-product
 * documents. Each reader has its own document holding only what it shows.
 *
 * `getCompanyOrders` (company-wide) rather than `getOrders`, which holds only
 * the signed-in buyer's own orders: these are the products the company bought.
 */
async function readCompanyOrders(
  event: H3Event,
  document: string,
  userToken: string | undefined,
): Promise<RawOrder[]> {
  const sdk = await getTenantSDK(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery(document),
        variables: {
          ...getRequestChannelVariables(sdk, event),
        },
        userToken,
      }),
    'order',
    OrderError,
  );
  return (unwrapGraphQL(result) as RawOrder[] | null) ?? [];
}

/** One product as summed over every order, keyed by its article number. */
interface SummedProduct {
  articleNumber: string;
  productId?: number;
  type?: string | null;
  name: string;
  alias: string | null;
  skuId?: number;
  totalQuantity: number;
  latestTime: number;
  latestOrder: RawOrder;
  latestLine: RawOrderItem;
}

/**
 * Sums every order line by article number. The product's id, type and name
 * come from its first line; its sku, price and order from its newest; its
 * alias from the first line that has one. Answered in the order first met.
 */
function sumByArticle(orders: RawOrder[]): SummedProduct[] {
  const byArticle = new Map<string, SummedProduct>();
  for (const order of orders) {
    const time = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    for (const line of order.cart?.items ?? []) {
      const product = line.product;
      const articleNumber = product?.articleNumber;
      if (!product || !articleNumber) continue;
      const quantity = line.quantity ?? 0;
      const existing = byArticle.get(articleNumber);
      if (!existing) {
        byArticle.set(articleNumber, {
          articleNumber,
          productId: product.productId ?? undefined,
          type: product.type,
          name: product.name ?? '',
          alias: product.alias ?? null,
          skuId: line.skuId ?? undefined,
          totalQuantity: quantity,
          latestTime: time,
          latestOrder: order,
          latestLine: line,
        });
        continue;
      }
      existing.totalQuantity += quantity;
      if (time > existing.latestTime) {
        existing.latestTime = time;
        existing.latestOrder = order;
        existing.latestLine = line;
        existing.skuId = line.skuId ?? existing.skuId;
      }
      if (!existing.alias && product.alias) {
        existing.alias = product.alias;
      }
    }
  }
  return [...byArticle.values()];
}

function newestFirst(products: SummedProduct[]): SummedProduct[] {
  return [...products].sort((a, b) => b.latestTime - a.latestTime);
}

function pricesOf(line: RawOrderItem) {
  return {
    priceExVat: line.unitPrice?.sellingPriceExVat ?? undefined,
    priceExVatFormatted:
      line.unitPrice?.sellingPriceExVatFormatted ?? undefined,
    priceIncVat: line.unitPrice?.sellingPriceIncVat ?? undefined,
    priceIncVatFormatted:
      line.unitPrice?.sellingPriceIncVatFormatted ?? undefined,
  };
}

function productIdsOf(products: SummedProduct[]): number[] {
  return [
    ...new Set(
      products
        .map((product) => product.productId)
        .filter((id): id is number => id != null),
    ),
  ];
}

/**
 * Name, alias and image in the language of the page: an order line carries
 * the first two only in the language the order was placed in. What the
 * catalogue lacks stays as the line has it; the image comes only from here.
 */
async function readCatalogue(
  products: SummedProduct[],
  event: H3Event,
  userToken: string | undefined,
): Promise<(product: SummedProduct) => CatalogueProduct | undefined> {
  const ids = productIdsOf(products);
  const catalogue = ids.length
    ? await getCatalogueProducts(ids, event, userToken)
    : new Map<number, CatalogueProduct>();
  return (product) =>
    product.productId != null ? catalogue.get(product.productId) : undefined;
}

function shownAs(product: SummedProduct, fromCatalogue?: CatalogueProduct) {
  const image = fromCatalogue?.productImages?.[0];
  const hasImage = !!image?.fileName;
  return {
    name: fromCatalogue?.name || product.name,
    articleNumber: product.articleNumber,
    alias: fromCatalogue?.alias || product.alias,
    imageFileName: hasImage ? image.fileName : null,
    imageUrl: hasImage ? (image.url ?? null) : null,
    ...pricesOf(product.latestLine),
  };
}

/**
 * "Köpta produkter": every product the company bought, newest first, with
 * its total, its latest order and who placed it.
 */
export async function getPurchasedProducts(
  event: H3Event,
): Promise<{ products: PurchasedProduct[]; total: number }> {
  const userToken = buildRequestContext(event)?.userToken;
  const orders = await readCompanyOrders(
    event,
    'orders/purchased-products.graphql',
    userToken,
  );
  if (!orders.length) return { products: [], total: 0 };

  // The order holds customerEmail (who placed it), not a name: match it
  // against the company's buyers, whose id is the email.
  const company = await getCompany(event);
  const buyerNameByEmail = new Map<string, string>();
  for (const buyer of company?.buyers ?? []) {
    const fullName = [buyer.firstName, buyer.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (buyer.id && fullName) {
      buyerNameByEmail.set(buyer.id.trim().toLowerCase(), fullName);
    }
  }
  // A buyer who has left the company keeps the raw email; an order without
  // one falls back to the billing name.
  const buyerNameOf = (order: RawOrder) => {
    const email = order.customerEmail?.trim().toLowerCase();
    const billingName = [
      order.billingAddress?.firstName ?? '',
      order.billingAddress?.lastName ?? '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      (email ? buyerNameByEmail.get(email) : undefined) ??
      (order.customerEmail || billingName)
    );
  };

  const summed = sumByArticle(orders);
  const catalogueOf = await readCatalogue(summed, event, userToken);
  const products = newestFirst(summed).map((product) => ({
    ...shownAs(product, catalogueOf(product)),
    totalQuantity: product.totalQuantity,
    latestOrderDate: product.latestOrder.createdAt ?? '',
    latestOrderId: String(product.latestOrder.id ?? ''),
    latestOrderPublicId: product.latestOrder.publicId ?? null,
    latestBuyerName: buyerNameOf(product.latestOrder),
  }));

  return { products, total: products.length };
}

/**
 * The start page: the newest purchased products as cards, the count of all,
 * and the name of the one bought in the largest quantity. Only the cards and
 * the most-bought product are looked up in the catalogue.
 */
export async function getPurchasedProductsOverview(
  event: H3Event,
): Promise<PurchasedProductsOverview> {
  const userToken = buildRequestContext(event)?.userToken;
  const orders = await readCompanyOrders(
    event,
    'orders/purchased-products-overview.graphql',
    userToken,
  );
  const summed = newestFirst(sumByArticle(orders));
  if (!summed.length) {
    return { products: [], total: 0, mostPurchasedName: null };
  }

  const newest = summed.slice(0, OVERVIEW_PRODUCTS);
  // A tie goes to the more recently bought, the one met first.
  const mostPurchased = summed.reduce((a, b) =>
    a.totalQuantity >= b.totalQuantity ? a : b,
  );
  const catalogueOf = await readCatalogue(
    [...newest, mostPurchased],
    event,
    userToken,
  );

  const isConfigurable = configurableCheck(event);
  const products: PurchasedProductCard[] = newest.map((product) => {
    const configurable = isConfigurable({
      productId: String(product.productId),
      type: product.type,
    });
    return {
      ...shownAs(product, catalogueOf(product)),
      ...(product.skuId != null && { skuId: product.skuId }),
      ...(configurable ? { configurable } : {}),
    };
  });

  return {
    products,
    total: summed.length,
    mostPurchasedName: catalogueOf(mostPurchased)?.name || mostPurchased.name,
  };
}

/**
 * The company's newest order holding the product under any sku or article
 * number, or null when the company never ordered it.
 */
export async function getLatestOrderForProduct(
  event: H3Event,
  productId: number,
): Promise<LatestProductOrder | null> {
  const orders = await readCompanyOrders(
    event,
    'orders/latest-order-for-product.graphql',
    buildRequestContext(event)?.userToken,
  );
  let latest: { order: RawOrder; time: number } | null = null;
  for (const order of orders) {
    const holdsProduct = order.cart?.items?.some(
      (line) => line.product?.productId === productId,
    );
    if (!holdsProduct) continue;
    const time = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    if (!latest || time > latest.time) latest = { order, time };
  }
  if (!latest) return null;
  return {
    id: String(latest.order.id ?? ''),
    publicId: latest.order.publicId ?? null,
    createdAt: latest.order.createdAt ?? '',
  };
}
