import type { CartType, CartItemType } from '@geins/types';
import type { H3Event } from 'h3';
import { getGeinsClient } from './_client';

// Cart operations require loading the cart first to set the internal cart ID.
// API routes should pass cartId from cookies/headers. If no cartId, a new cart
// is created automatically by the SDK.

export async function getCart(
  cartId: string | undefined,
  event: H3Event,
): Promise<CartType | undefined> {
  const { oms } = await getGeinsClient(event);
  return oms.cart.get(cartId);
}

export async function createCart(
  event: H3Event,
): Promise<CartType | undefined> {
  const { oms } = await getGeinsClient(event);
  return oms.cart.create();
}

export async function addItem(
  args: { cartId?: string; skuId?: number; quantity?: number },
  event: H3Event,
): Promise<boolean> {
  const { oms } = await getGeinsClient(event);
  // Load cart first to set internal ID, then add item
  if (args.cartId) {
    await oms.cart.get(args.cartId);
  }
  return oms.cart.items.add({ skuId: args.skuId, quantity: args.quantity });
}

export async function updateItem(
  args: { cartId?: string; item: CartItemType },
  event: H3Event,
): Promise<boolean> {
  const { oms } = await getGeinsClient(event);
  if (args.cartId) {
    await oms.cart.get(args.cartId);
  }
  return oms.cart.items.update({ item: args.item });
}

export async function removeItem(
  args: { cartId?: string; skuId?: number; quantity?: number },
  event: H3Event,
): Promise<boolean> {
  const { oms } = await getGeinsClient(event);
  if (args.cartId) {
    await oms.cart.get(args.cartId);
  }
  return oms.cart.items.remove({ skuId: args.skuId, quantity: args.quantity });
}

export async function deleteItem(
  args: { cartId?: string; id?: string; skuId?: number },
  event: H3Event,
): Promise<boolean> {
  const { oms } = await getGeinsClient(event);
  if (args.cartId) {
    await oms.cart.get(args.cartId);
  }
  return oms.cart.items.delete({ id: args.id, skuId: args.skuId });
}

export async function clearCart(
  cartId: string | undefined,
  event: H3Event,
): Promise<boolean> {
  const { oms } = await getGeinsClient(event);
  if (cartId) {
    await oms.cart.get(cartId);
  }
  return oms.cart.items.clear();
}

export async function applyPromoCode(
  args: { cartId?: string; promoCode: string },
  event: H3Event,
): Promise<boolean> {
  const { oms } = await getGeinsClient(event);
  if (args.cartId) {
    await oms.cart.get(args.cartId);
  }
  return oms.cart.promotionCode.apply(args.promoCode);
}

export async function removePromoCode(
  cartId: string | undefined,
  event: H3Event,
): Promise<boolean> {
  const { oms } = await getGeinsClient(event);
  if (cartId) {
    await oms.cart.get(cartId);
  }
  return oms.cart.promotionCode.remove();
}
