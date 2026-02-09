import type { CartType, CartItemInputType } from '@geins/types';
import { CartError } from '@geins/core';
import type { H3Event } from 'h3';
import { getTenantSDK } from './_sdk';

export async function getCart(
  cartId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.cart.get(cartId);
  } catch (error) {
    if (error instanceof CartError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(ErrorCode.EXTERNAL_API_ERROR, 'Failed to get cart');
  }
}

export async function createCart(event: H3Event): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.cart.create();
  } catch (error) {
    if (error instanceof CartError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(ErrorCode.EXTERNAL_API_ERROR, 'Failed to create cart');
  }
}

export async function addItem(
  cartId: string,
  input: CartItemInputType,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.cart.addItem(cartId, input);
  } catch (error) {
    if (error instanceof CartError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to add item to cart',
    );
  }
}

export async function updateItem(
  cartId: string,
  input: CartItemInputType,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.cart.updateItem(cartId, input);
  } catch (error) {
    if (error instanceof CartError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to update cart item',
    );
  }
}

export async function deleteItem(
  cartId: string,
  itemId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.cart.deleteItem(cartId, itemId);
  } catch (error) {
    if (error instanceof CartError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to delete cart item',
    );
  }
}

export async function applyPromoCode(
  cartId: string,
  promoCode: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.cart.setPromotionCode(cartId, promoCode);
  } catch (error) {
    if (error instanceof CartError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to apply promotion code',
    );
  }
}

export async function removePromoCode(
  cartId: string,
  event: H3Event,
): Promise<CartType> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.cart.removePromotionCode(cartId);
  } catch (error) {
    if (error instanceof CartError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to remove promotion code',
    );
  }
}
