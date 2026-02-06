import type {
  CheckoutType,
  CreateOrderOptions,
  CreateOrderResponseType,
  GetCheckoutOptions,
  GenerateCheckoutTokenOptions,
  ValidateOrderCreationResponseType,
  CheckoutSummaryType,
} from '@geins/types';
import type { H3Event } from 'h3';
import { getGeinsClient } from './_client';

export async function getCheckout(
  args: GetCheckoutOptions,
  event: H3Event,
): Promise<CheckoutType | undefined> {
  const { oms } = await getGeinsClient(event);
  return oms.checkout.get(args);
}

export async function validateOrder(
  args: CreateOrderOptions,
  event: H3Event,
): Promise<ValidateOrderCreationResponseType | undefined> {
  const { oms } = await getGeinsClient(event);
  return oms.checkout.validate(args);
}

export async function createOrder(
  args: CreateOrderOptions,
  event: H3Event,
): Promise<CreateOrderResponseType | undefined> {
  const { oms } = await getGeinsClient(event);
  return oms.checkout.createOrder(args);
}

export async function getSummary(
  args: { orderId: string; paymentMethod: string },
  event: H3Event,
): Promise<CheckoutSummaryType | undefined> {
  const { oms } = await getGeinsClient(event);
  return oms.checkout.summary(args);
}

export async function createToken(
  args: GenerateCheckoutTokenOptions,
  event: H3Event,
): Promise<string | undefined> {
  const { oms } = await getGeinsClient(event);
  return oms.checkout.createToken(args);
}
