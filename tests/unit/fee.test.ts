import { describe, it, expect } from 'vitest';
import { feeOf } from '../../app/utils/fee';

describe('feeOf', () => {
  it('shows the formatted fee when there is one', () => {
    expect(feeOf(29, '29,00 kr')).toBe('29,00 kr');
  });

  it.each([0, -5, null, undefined])(
    'shows nothing for an amount of %s',
    (amount) => {
      expect(feeOf(amount, '0,00 kr')).toBeUndefined();
    },
  );

  it.each(['', null, undefined])(
    'shows nothing when the formatted fee is %j',
    (formatted) => {
      expect(feeOf(29, formatted)).toBeUndefined();
    },
  );
});
