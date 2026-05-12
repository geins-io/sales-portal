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
  // Geins cartCopy does not re-evaluate pricelist/discount rules against
  // the authenticated context — the new cart is returned at guest prices.
  // A subsequent cart.get with forceRefresh=true forces Geins to re-resolve
  // prices under the userToken, so the user sees their pricelist immediately
  // after login instead of after the next add-to-cart.
  return wrapServiceCall(
    async () => {
      const copied = await oms.cart.copy(cartId, {}, ctx);
      return oms.cart.get(copied.id, true, ctx);
    },
    'cart',
    CartError,
  );
}
