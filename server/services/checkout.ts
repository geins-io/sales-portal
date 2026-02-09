import type {
  CheckoutType,
  CreateOrderOptions,
  CreateOrderResponseType,
  GetCheckoutOptions,
  GenerateCheckoutTokenOptions,
  ValidateOrderCreationResponseType,
  CheckoutSummaryType,
} from '@geins/types';
import { CheckoutError } from '@geins/core';
import type { H3Event } from 'h3';
import { getTenantSDK } from './_sdk';

export async function getCheckout(
  args: GetCheckoutOptions,
  event: H3Event,
): Promise<CheckoutType | undefined> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.checkout.get(args);
  } catch (error) {
    if (error instanceof CheckoutError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to get checkout',
    );
  }
}

export async function validateOrder(
  args: CreateOrderOptions,
  event: H3Event,
): Promise<ValidateOrderCreationResponseType | undefined> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.checkout.validate(args);
  } catch (error) {
    if (error instanceof CheckoutError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to validate order',
    );
  }
}

export async function createOrder(
  args: CreateOrderOptions,
  event: H3Event,
): Promise<CreateOrderResponseType | undefined> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.checkout.createOrder(args);
  } catch (error) {
    if (error instanceof CheckoutError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to create order',
    );
  }
}

export async function getSummary(
  args: { orderId: string; paymentMethod: string },
  event: H3Event,
): Promise<CheckoutSummaryType | undefined> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.checkout.summary(args);
  } catch (error) {
    if (error instanceof CheckoutError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to get checkout summary',
    );
  }
}

export async function createToken(
  args: GenerateCheckoutTokenOptions,
  event: H3Event,
): Promise<string | undefined> {
  const { oms } = await getTenantSDK(event);
  try {
    return await oms.checkout.createToken(args);
  } catch (error) {
    if (error instanceof CheckoutError) {
      throw createAppError(ErrorCode.BAD_REQUEST, error.message);
    }
    throw createAppError(
      ErrorCode.EXTERNAL_API_ERROR,
      'Failed to create checkout token',
    );
  }
}
