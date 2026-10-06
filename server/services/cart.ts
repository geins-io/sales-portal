import type { CartType as SdkCartType } from '@geins/types';
import { CartError } from '@geins/core';
import type { H3Event } from 'h3';
import type {
  CartItemInputType,
  CartLineConfiguration,
  CartType,
} from '#shared/types/commerce';
import { createAppError, ErrorCode } from '../utils/errors';
import { canAccessFeatureServer } from '../utils/feature-access';
import { logger } from '../utils/logger';
import { isSdkLoginRequired } from '../utils/sdk-error';
import { getTenantSDK, buildRequestContext } from './_sdk';
import {
  buildConfiguratorRequestContext,
  getConfiguratorBackend,
  type ConfiguratorBackend,
} from './configurator';

// ---------------------------------------------------------------------------
// The SDK's cart, with each configured line's configuration merged in from the
// configurator backend's own read, until the SDK's cart carries it.
// ---------------------------------------------------------------------------

/** The configurator backend, when the request may have configured lines at all. */
async function configuratorFor(
  event: H3Event,
): Promise<ConfiguratorBackend | null> {
  const mayConfigure = await canAccessFeatureServer(event, 'configurator', {
    authenticated: !!getSessionToken(event),
  });
  return mayConfigure ? getConfiguratorBackend(event) : null;
}

/** Never throws: without the read, the lines render without a configuration. */
async function lineConfigurations(
  cartId: string,
  event: H3Event,
  backend: ConfiguratorBackend | null,
): Promise<Map<string, CartLineConfiguration>> {
  if (!backend) return new Map();
  try {
    return await backend.cartLineConfigurations(
      cartId,
      await buildConfiguratorRequestContext(event),
    );
  } catch {
    logger.warn('[configurator] cart line configurations unavailable');
    return new Map();
  }
}

function withLineConfigurations(
  cart: SdkCartType,
  lines: Map<string, CartLineConfiguration>,
): CartType {
  // The SDK answers null for a cart it cannot find, whatever its type says.
  if (!cart || lines.size === 0) return cart;
  return {
    ...cart,
    items: cart.items.map((item) => {
      const configuration = item.id ? lines.get(item.id) : undefined;
      return configuration ? { ...item, configuration } : item;
    }),
  };
}

/**
 * A refusal to read until the buyer signs in is the buyer's state, not an
 * outage. Signed in, it is another buyer's cart, which sign-in cannot open, so
 * it fails as before and the buyer gets a cart of their own.
 */
function signInRequired(error: unknown, signedIn: boolean): never {
  if (!signedIn && isSdkLoginRequired(error)) {
    throw createAppError(ErrorCode.CART_LOGIN_REQUIRED);
  }
  throw error;
}

async function readCart(
  cartId: string,
  event: H3Event,
  backend: ConfiguratorBackend | null,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  const signedIn = !!getSessionToken(event);
  const [cart, lines] = await Promise.all([
    wrapServiceCall(
      () =>
        oms.cart
          .get(cartId, false, ctx)
          .catch((error: unknown) => signInRequired(error, signedIn)),
      'cart',
      CartError,
    ),
    lineConfigurations(cartId, event, backend),
  ]);
  return withLineConfigurations(cart, lines);
}

/** A change reads the lines after it answers, so the read sees the change. */
async function changed(
  cartId: string,
  event: H3Event,
  change: () => Promise<SdkCartType>,
): Promise<CartType> {
  const backend = await configuratorFor(event);
  const cart = await wrapServiceCall(change, 'cart', CartError);
  return withLineConfigurations(
    cart,
    await lineConfigurations(cartId, event, backend),
  );
}

export async function getCart(
  cartId: string,
  event: H3Event,
): Promise<CartType> {
  return readCart(cartId, event, await configuratorFor(event));
}

export async function createCart(event: H3Event): Promise<SdkCartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return wrapServiceCall(() => oms.cart.create(ctx), 'cart', CartError);
}

export async function addItem(
  cartId: string,
  input: CartItemInputType,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return changed(cartId, event, () => oms.cart.addItem(cartId, input, ctx));
}

export async function updateItem(
  cartId: string,
  input: CartItemInputType,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return changed(cartId, event, () => oms.cart.updateItem(cartId, input, ctx));
}

export async function deleteItem(
  cartId: string,
  itemId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return changed(cartId, event, () => oms.cart.deleteItem(cartId, itemId, ctx));
}

export async function applyPromoCode(
  cartId: string,
  promoCode: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return changed(cartId, event, () =>
    oms.cart.setPromotionCode(cartId, promoCode, ctx),
  );
}

export async function removePromoCode(
  cartId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return changed(cartId, event, () =>
    oms.cart.removePromotionCode(cartId, ctx),
  );
}

export async function copyCart(
  cartId: string,
  event: H3Event,
  userToken: string,
): Promise<SdkCartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = { ...buildRequestContext(event), userToken };
  // Not `configuratorFor`: the cart may hold a configured line whatever the
  // gate says now, and the request carries no session yet.
  const backend = getConfiguratorBackend(event);
  const configuratorCtx = {
    ...(await buildConfiguratorRequestContext(event)),
    userToken,
  };
  // Geins does not reprice items in cartCopy and forceRefresh on cartGet
  // doesn't help either — prices in those mutations are locked at the
  // moment the line was originally added (guest context). The only way
  // to get pricelist prices applied is to re-resolve each line through
  // addItem under the authenticated context, which runs the full SKU
  // pricing pipeline. A configured line is carried by its committed id
  // instead: added by SKU it would lose its configuration and its price.
  // A configured line that cannot be carried fails the copy.
  return wrapServiceCall(
    async () => {
      const [guest, configured] = await Promise.all([
        oms.cart.get(cartId, false, ctx),
        backend.cartLineConfigurations(cartId, configuratorCtx),
      ]);
      const authed = await oms.cart.create(ctx);
      for (const item of guest.items ?? []) {
        if (item.skuId == null || item.quantity <= 0) continue;
        const configuration = item.id ? configured.get(item.id) : undefined;
        if (configuration) {
          await backend.addToCart(
            authed.id,
            {
              committedConfigurationId: configuration.configurationId,
              skuId: item.skuId,
              quantity: item.quantity,
            },
            {
              ...configuratorCtx,
              // With the new token: the request carries no session yet.
              cart: {
                addPlainItem: (id, line) => oms.cart.addItem(id, line, ctx),
              },
            },
          );
          continue;
        }
        try {
          await oms.cart.addItem(
            authed.id,
            {
              skuId: item.skuId,
              quantity: item.quantity,
              ...(item.groupKey ? { groupKey: item.groupKey } : {}),
            },
            ctx,
          );
        } catch {
          // Skip items that fail to re-add (e.g. SKU now out of stock or
          // unavailable under the user's market). The login itself must
          // not fail because one stale line couldn't be carried over.
        }
      }
      return oms.cart.get(authed.id, false, ctx);
    },
    'cart',
    CartError,
  );
}
