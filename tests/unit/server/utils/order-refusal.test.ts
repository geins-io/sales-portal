// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { orderRefusalCode } from '../../../../server/utils/order-refusal';
import { ErrorCode } from '../../../../server/utils/errors';

describe('orderRefusalCode', () => {
  it('answers INVALID_IDENTITY_NUMBER with its own code', () => {
    expect(orderRefusalCode('INVALID_IDENTITY_NUMBER')).toBe(
      ErrorCode.ORDER_INVALID_IDENTITY_NUMBER,
    );
  });

  it.each(['CartBelongsToAnotherCompany', 'LoginRequired'])(
    'answers %s, a code Geins sends elsewhere, with ORDER_FAILED',
    (code) => {
      expect(orderRefusalCode(code)).toBe(ErrorCode.ORDER_FAILED);
    },
  );

  it('answers a refusal without a code with ORDER_FAILED', () => {
    expect(orderRefusalCode(undefined)).toBe(ErrorCode.ORDER_FAILED);
  });

  it('answers a code it does not know with ORDER_FAILED', () => {
    expect(orderRefusalCode('PAYMENT_DECLINED')).toBe(ErrorCode.ORDER_FAILED);
    expect(orderRefusalCode('')).toBe(ErrorCode.ORDER_FAILED);
  });

  it('does not take a key of every object for a code', () => {
    expect(orderRefusalCode('toString')).toBe(ErrorCode.ORDER_FAILED);
    expect(orderRefusalCode('__proto__')).toBe(ErrorCode.ORDER_FAILED);
  });

  it('matches the code exactly as Geins sends it', () => {
    expect(orderRefusalCode('invalid_identity_number')).toBe(
      ErrorCode.ORDER_FAILED,
    );
  });
});
