import type { CartType, CartItemInputType } from '@geins/types';
import { CartError } from '@geins/core';
import type { H3Event } from 'h3';
import { getTenantSDK, buildRequestContext } from './_sdk';

export async function getCart(
  cartId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.get(cartId, false, requestContext),
    'cart',
    CartError,
  );
}

export async function createCart(event: H3Event): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.create(requestContext),
    'cart',
    CartError,
  );
}

export async function addItem(
  cartId: string,
  input: CartItemInputType,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.addItem(cartId, input, requestContext),
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
  const requestContext = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.updateItem(cartId, input, requestContext),
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
  const requestContext = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.deleteItem(cartId, itemId, requestContext),
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
  const requestContext = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.setPromotionCode(cartId, promoCode, requestContext),
    'cart',
    CartError,
  );
}

export async function removePromoCode(
  cartId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  const requestContext = buildRequestContext(event);
  return wrapServiceCall(
    () => oms.cart.removePromotionCode(cartId, requestContext),
    'cart',
    CartError,
  );
}
