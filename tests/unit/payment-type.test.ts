import { describe, it, expect } from 'vitest';
import { paymentTypeLabelKey } from '../../app/utils/payment-type';

describe('paymentTypeLabelKey', () => {
  it.each([
    // STANDARD is the B2B invoice option, so it reads as invoice, not "standard".
    ['STANDARD', 'checkout.payment_types.invoice'],
    ['KLARNA', 'checkout.payment_types.klarna'],
    ['SVEA', 'checkout.payment_types.svea'],
    ['WALLEY', 'checkout.payment_types.walley'],
    ['AVARDA', 'checkout.payment_types.avarda'],
    ['GEINS_PAY', 'checkout.payment_types.geins_pay'],
  ])('labels %s with %s', (type, key) => {
    expect(paymentTypeLabelKey(type)).toBe(key);
  });

  // `toString` and `constructor` are on every object: only the map's own keys
  // are labels.
  it.each([
    undefined,
    null,
    '',
    'invoice',
    'standard',
    'toString',
    'constructor',
  ])('has no label for %j', (type) => {
    expect(paymentTypeLabelKey(type)).toBeUndefined();
  });
});
