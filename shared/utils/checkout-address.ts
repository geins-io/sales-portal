import type { AddressInputType } from '@geins/types';

/**
 * Geins's company (B2B) checkout requires `billingAddressId` / `shippingAddressId`
 * pointing at a predefined company address; consumer checkout takes the
 * literal `billingAddress` / `shippingAddress` object. Exactly one shape
 * per side, never both. This helper picks the correct pair to spread
 * into the placeOrder body.
 */
export function checkoutAddressFields(
  side: 'billing' | 'shipping',
  address: AddressInputType | undefined,
  addressId: string | null | undefined,
): Record<string, AddressInputType | string> {
  if (addressId) return { [`${side}AddressId`]: addressId };
  if (address) return { [`${side}Address`]: address };
  return {};
}
