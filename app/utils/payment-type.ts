import type { GeinsPaymentType } from '@geins/types';

// Keyed by every Geins payment type, so a new one in the SDK fails the build
// here rather than rendering without a label.
const PAYMENT_TYPE_LABELS: Record<`${GeinsPaymentType}`, string> = {
  // STANDARD is the B2B invoice option. Label it "Faktura" (Invoice) rather
  // than a generic "standard payment", so the buyer sees what it means.
  STANDARD: 'checkout.payment_types.invoice',
  KLARNA: 'checkout.payment_types.klarna',
  SVEA: 'checkout.payment_types.svea',
  WALLEY: 'checkout.payment_types.walley',
  AVARDA: 'checkout.payment_types.avarda',
  GEINS_PAY: 'checkout.payment_types.geins_pay',
};

function isPaymentType(type: string): type is `${GeinsPaymentType}` {
  return Object.hasOwn(PAYMENT_TYPE_LABELS, type);
}

/** The label key for a Geins payment type, or undefined for anything else. */
export function paymentTypeLabelKey(
  type: string | null | undefined,
): string | undefined {
  return type && isPaymentType(type) ? PAYMENT_TYPE_LABELS[type] : undefined;
}
