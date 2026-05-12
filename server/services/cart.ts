import type { CartType, CartItemInputType } from '@geins/types';
import { CartError } from '@geins/core';
import type { H3Event } from 'h3';
import { getTenantSDK, buildRequestContext } from './_sdk';

export async function getCart(
  cartId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.get(cartId, false, ctx),
    'cart',
    CartError,
  );
}

export async function createCart(event: H3Event): Promise<CartType> {
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
  return wrapServiceCall(
    () => oms.cart.addItem(cartId, input, ctx),
    'cart',
    CartError,
  );
}

export async function updateItem(
  cartId: string,
  input: CartItemInputType,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.updateItem(cartId, input, ctx),
    'cart',
    CartError,
  );
}

export async function deleteItem(
  cartId: string,
  itemId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.deleteItem(cartId, itemId, ctx),
    'cart',
    CartError,
  );
}

export async function applyPromoCode(
  cartId: string,
  promoCode: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.setPromotionCode(cartId, promoCode, ctx),
    'cart',
    CartError,
  );
}

export async function removePromoCode(
  cartId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.removePromotionCode(cartId, ctx),
    'cart',
    CartError,
  );
}

export async function copyCart(
  cartId: string,
  event: H3Event,
  userToken: string,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const ctx = { ...buildRequestContext(event), userToken };
  // Geins does not reprice items in cartCopy and forceRefresh on cartGet
  // doesn't help either — prices in those mutations are locked at the
  // moment the line was originally added (guest context). The only way
  // to get pricelist prices applied is to re-resolve each line through
  // addItem under the authenticated context, which runs the full SKU
  // pricing pipeline.
  return wrapServiceCall(
    async () => {
      const guest = await oms.cart.get(cartId, false, ctx);
      const authed = await oms.cart.create(ctx);
      for (const item of guest.items ?? []) {
        if (item.skuId == null || item.quantity <= 0) continue;
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
