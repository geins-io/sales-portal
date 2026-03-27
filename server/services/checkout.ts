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
  return wrapServiceCall(
    () => oms.checkout.get(args),
    'checkout',
    CheckoutError,
  );
}

export async function validateOrder(
  args: CreateOrderOptions,
  event: H3Event,
): Promise<ValidateOrderCreationResponseType | undefined> {
  const { oms } = await getTenantSDK(event);
  return wrapServiceCall(
    () => oms.checkout.validate(args),
    'checkout',
    CheckoutError,
  );
}

export async function createOrder(
  args: CreateOrderOptions,
  event: H3Event,
): Promise<CreateOrderResponseType | undefined> {
  const { oms } = await getTenantSDK(event);
  return wrapServiceCall(
    () => oms.checkout.createOrder(args),
    'checkout',
    CheckoutError,
  );
}

export async function getSummary(
  args: { orderId: string; paymentMethod: string },
  event: H3Event,
): Promise<CheckoutSummaryType | undefined> {
  const { oms } = await getTenantSDK(event);
  return wrapServiceCall(
    () => oms.checkout.summary(args),
    'checkout',
    CheckoutError,
  );
}

export async function createToken(
  args: GenerateCheckoutTokenOptions,
  event: H3Event,
): Promise<string | undefined> {
  const { oms } = await getTenantSDK(event);
  return wrapServiceCall(
    () => oms.checkout.createToken(args),
    'checkout',
    CheckoutError,
  );
}
