import type {
  CartItemType as SdkCartItemType,
  OrderSummaryType,
} from '@geins/types';
import { OrderError } from '@geins/core';
import type { H3Event } from 'h3';
import type {
  OrderDetailItem,
  OrderDetailType,
  OrderListItem,
  OrderListPage,
} from '#shared/types/commerce';
import type { ListOrdersInput } from '../schemas/api-input';
import {
  getTenantSDK,
  buildRequestContext,
  getRequestChannelVariables,
} from './_sdk';
import { loadQuery } from './graphql/loader';
import { unwrapGraphQL } from './graphql/unwrap';
import { getCompany } from './company';
import type { ConfigurableCandidate } from './configurator';
import { configurableCheck } from './configurator';
import { lineConfiguration } from './line-configuration';
import { amountWriter } from './amount';
import { getCatalogueProducts } from './products';

/**
 * Puts each row's configurable flag and its configuration, as the buyer reads
 * it, on the row. The product's type is for the configurable check and goes
 * no further.
 */
export function toOrderDetail(
  order: OrderSummaryType,
  isConfigurable: (product: ConfigurableCandidate) => boolean,
): OrderDetailType {
  const { cart } = order;
  const toRow = (row: SdkCartItemType): OrderDetailItem => {
    if (!row) return row;
    const { configurationId: _id, configuration, ...item } = row;
    const detail: OrderDetailItem = configuration
      ? { ...item, configuration: lineConfiguration(configuration) }
      : item;
    if (!item.product) return detail;
    const { type, ...product } = item.product;
    const configurable =
      product.productId != null &&
      isConfigurable({
        productId: String(product.productId),
        type: type ?? null,
      });
    return {
      ...detail,
      product: configurable ? { ...product, configurable: true } : product,
    };
  };
  // A cart or its rows the SDK answered null for stay null.
  return {
    ...order,
    cart: cart && { ...cart, items: cart.items && cart.items.map(toRow) },
  };
}

export async function getOrder(
  args: { publicOrderId: string; checkoutMarketId?: string },
  event: H3Event,
): Promise<OrderDetailType | undefined> {
  const { oms } = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const order = await wrapServiceCall(
    () => oms.order.get(args, requestContext),
    'order',
    OrderError,
  );
  if (!order) return undefined;
  return inPageLanguage(
    toOrderDetail(order, configurableCheck(event)),
    event,
    requestContext?.userToken,
  );
}

/**
 * Each row's product name, alias, link and images in the language of the
 * page. The order carries them only in the language it was placed in; in any
 * other its alias is empty and its images null. A product the catalogue no
 * longer has keeps what the order carries.
 */
async function inPageLanguage(
  order: OrderDetailType,
  event: H3Event,
  userToken: string | undefined,
): Promise<OrderDetailType> {
  const cart = order.cart;
  const items = cart?.items;
  if (!cart || !items) return order;
  // Typed as a string by the SDK; Geins answers the number.
  const idOf = (row: OrderDetailItem | null | undefined) =>
    Number(row?.product?.productId ?? NaN);
  const productIds = [...new Set(items.map(idOf).filter(Number.isInteger))];
  if (!productIds.length) return order;
  const catalogue = await getCatalogueProducts(productIds, event, userToken);

  return {
    ...order,
    cart: {
      ...cart,
      items: items.map((row) => {
        const found = catalogue.get(idOf(row));
        const product = row?.product;
        if (!found || !product) return row;
        const images = (found.productImages ?? []).flatMap((image) =>
          image?.fileName
            ? [{ fileName: image.fileName, url: image.url ?? null }]
            : [],
        );
        return {
          ...row,
          product: {
            ...product,
            ...(found.name && { name: found.name }),
            ...(found.alias && { alias: found.alias }),
            ...(found.canonicalUrl && { canonicalUrl: found.canonicalUrl }),
            ...(images.length && { productImages: images }),
          },
        };
      }),
    },
  };
}

/**
 * The public id of an order known by its number, which is all a quotation
 * knows of the order it became. Geins answers null alike for an order not
 * readable yet, one of another company and one that does not exist.
 */
export async function findOrderPublicId(
  orderNumber: number,
  event: H3Event,
): Promise<string | undefined> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const result = await wrapServiceCall(
    () =>
      sdk.core.graphql.query({
        queryAsString: loadQuery('orders/order-public-id.graphql'),
        variables: {
          orderId: orderNumber,
          ...getRequestChannelVariables(sdk, event),
        },
        userToken: requestContext?.userToken,
      }),
    'order',
    OrderError,
  );
  const order = unwrapGraphQL(result) as { publicId?: string } | null;
  return order?.publicId || undefined;
}

/** The order by its number, read as the portal reads every order. */
export async function getOrderByNumber(
  orderNumber: number,
  event: H3Event,
): Promise<OrderDetailType | undefined> {
  const publicOrderId = await findOrderPublicId(orderNumber, event);
  return publicOrderId ? getOrder({ publicOrderId }, event) : undefined;
}

/** The order's total written as the order page writes it, from the numbers. */
function withTotalWritten(order: OrderListItem, locale: string): OrderListItem {
  const total = order.orderTotal;
  if (!total) return order;
  const amount = amountWriter(order.currency, locale);
  return {
    ...order,
    orderTotal: {
      ...total,
      sellingPriceIncVatFormatted: amount(
        total.sellingPriceIncVat,
        total.sellingPriceIncVatFormatted,
      ),
      sellingPriceExVatFormatted: amount(
        total.sellingPriceExVat,
        total.sellingPriceExVatFormatted,
      ),
    },
  };
}

/** A page of orders as Geins answers it. */
interface RawOrderPage {
  count?: number | null;
  orders?: OrderListItem[] | null;
}

/**
 * Reads a page of orders together with the company buyer roster, and puts
 * each order's buyer name and written total on it.
 */
async function readOrderPage(
  queryFile: string,
  variables: Record<string, unknown>,
  event: H3Event,
): Promise<OrderListPage> {
  const sdk = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  const channel = getRequestChannelVariables(sdk, event);
  const [orderResult, company] = await Promise.all([
    wrapServiceCall(
      () =>
        sdk.core.graphql.query({
          queryAsString: loadQuery(queryFile),
          variables: { ...variables, ...channel },
          userToken: requestContext?.userToken,
        }),
      'order',
      OrderError,
    ),
    getCompany(event).catch(() => null),
  ]);
  // Each query asks for one root, so one key comes back.
  const page = unwrapGraphQL(orderResult) as RawOrderPage | null;
  // The order's numeric customerId matches CompanyBuyer.internalId, which is
  // per order and reliable; customerEmail is the fallback for orders from
  // before customerId. An unresolved row stays null so the table shows a dash,
  // never the billing contact, who did not necessarily place the order.
  const nameByInternalId = new Map<string, string>();
  const nameByEmail = new Map<string, string>();
  for (const buyer of company?.buyers ?? []) {
    const name = [buyer.firstName, buyer.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!name) continue;
    if (buyer.internalId) nameByInternalId.set(String(buyer.internalId), name);
    if (buyer.id) nameByEmail.set(buyer.id.toLowerCase(), name);
  }
  const orders = (page?.orders ?? []).map((order) => {
    const internalId =
      order.customerId !== undefined && order.customerId !== null
        ? String(order.customerId)
        : null;
    const email = order.customerEmail?.toLowerCase();
    const placedBy =
      (internalId && nameByInternalId.get(internalId)) ||
      (email && nameByEmail.get(email)) ||
      null;
    return { ...withTotalWritten(order, channel.languageId), placedBy };
  });
  return { orders, total: page?.count ?? 0 };
}

/**
 * One page of the order list, newest first as Geins sends it: the company's
 * orders, or with `mine` the buyer's own.
 */
export function listOrders(
  query: ListOrdersInput,
  event: H3Event,
): Promise<OrderListPage> {
  return readOrderPage('orders/order-list-page.graphql', query, event);
}

/** The start page's newest company orders and how many the company has. */
export function getOrderOverview(event: H3Event): Promise<OrderListPage> {
  return readOrderPage('orders/order-overview.graphql', {}, event);
}
