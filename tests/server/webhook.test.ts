import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  MAX_WEBHOOK_BODY_SIZE,
  parseSignatureHeader,
  parseSecrets,
  computeHmacHex,
  verifySignature,
  verifyWithSecrets,
  validateTimestamp,
} from '../../server/utils/webhook';

describe('MAX_WEBHOOK_BODY_SIZE', () => {
  it('should be 64 KB', () => {
    expect(MAX_WEBHOOK_BODY_SIZE).toBe(65_536);
  });
});

describe('parseSignatureHeader', () => {
  it('should parse a valid header', () => {
    const result = parseSignatureHeader('t=1700000000,v1=abc123');
    expect(result).toEqual({ timestamp: 1700000000, signature: 'abc123' });
  });

  it('should return null when t is missing', () => {
    expect(parseSignatureHeader('v1=abc123')).toBeNull();
  });

  it('should return null when v1 is missing', () => {
    expect(parseSignatureHeader('t=1700000000')).toBeNull();
  });

  it('should return null when t is non-numeric', () => {
    expect(parseSignatureHeader('t=abc,v1=def')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseSignatureHeader('')).toBeNull();
  });

  it('should handle extra parts gracefully', () => {
    const result = parseSignatureHeader('t=123,v1=abc,v2=extra');
    expect(result).toEqual({ timestamp: 123, signature: 'abc' });
  });
});

describe('parseSecrets', () => {
  it('should return a single key', () => {
    expect(parseSecrets('my-secret')).toEqual(['my-secret']);
  });

  it('should split multiple keys', () => {
    expect(parseSecrets('key1,key2,key3')).toEqual(['key1', 'key2', 'key3']);
  });

  it('should trim whitespace', () => {
    expect(parseSecrets(' key1 , key2 ')).toEqual(['key1', 'key2']);
  });

  it('should filter empty entries', () => {
    expect(parseSecrets('key1,,key2,')).toEqual(['key1', 'key2']);
  });

  it('should return empty array for empty string', () => {
    expect(parseSecrets('')).toEqual([]);
  });
});

describe('computeHmacHex', () => {
  it('should return deterministic hex output', () => {
    const result = computeHmacHex('test-payload', 'test-secret');
    const expected = createHmac('sha256', 'test-secret')
      .update('test-payload')
      .digest('hex');
    expect(result).toBe(expected);
  });

  it('should produce different output for different secrets', () => {
    const a = computeHmacHex('same-payload', 'secret-a');
    const b = computeHmacHex('same-payload', 'secret-b');
    expect(a).not.toBe(b);
  });
});

describe('verifySignature', () => {
  const secret = 'test-secret';
  const payload = '1700000000.{"hostname":"test.com"}';

  it('should return true for a valid signature', () => {
    const hex = computeHmacHex(payload, secret);
    expect(verifySignature(payload, hex, secret)).toBe(true);
  });

  it('should return false for an invalid signature', () => {
    expect(verifySignature(payload, 'badhex', secret)).toBe(false);
  });

  it('should return false when signature lengths differ', () => {
    const hex = computeHmacHex(payload, secret);
    expect(verifySignature(payload, hex + 'aa', secret)).toBe(false);
  });
});

describe('verifyWithSecrets', () => {
  const payload = '1700000000.{"hostname":"test.com"}';

  it('should match on first key', () => {
    const hex = computeHmacHex(payload, 'key1');
    expect(verifyWithSecrets(payload, hex, ['key1', 'key2'])).toBe(true);
  });

  it('should match on second key (rotation)', () => {
    const hex = computeHmacHex(payload, 'key2');
    expect(verifyWithSecrets(payload, hex, ['key1', 'key2'])).toBe(true);
  });

  it('should return false when no keys match', () => {
    const hex = computeHmacHex(payload, 'key3');
    expect(verifyWithSecrets(payload, hex, ['key1', 'key2'])).toBe(false);
  });

  it('should return false for empty secrets array', () => {
    const hex = computeHmacHex(payload, 'any');
    expect(verifyWithSecrets(payload, hex, [])).toBe(false);
  });
});

describe('validateTimestamp', () => {
  it('should accept a fresh timestamp', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(validateTimestamp(nowSeconds)).toBe(true);
  });

  it('should accept a timestamp within the window', () => {
    const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120;
    expect(validateTimestamp(twoMinutesAgo)).toBe(true);
  });

  it('should reject a stale timestamp (>5 minutes)', () => {
    const sixMinutesAgo = Math.floor(Date.now() / 1000) - 360;
    expect(validateTimestamp(sixMinutesAgo)).toBe(false);
  });

  it('should reject a future timestamp', () => {
    const future = Math.floor(Date.now() / 1000) + 60;
    expect(validateTimestamp(future)).toBe(false);
  });

  it('should reject non-number values', () => {
    expect(validateTimestamp(undefined)).toBe(false);
    expect(validateTimestamp(null)).toBe(false);
    expect(validateTimestamp('1739700000')).toBe(false);
  });

  it('should reject NaN and Infinity', () => {
    expect(validateTimestamp(NaN)).toBe(false);
    expect(validateTimestamp(Infinity)).toBe(false);
  });

  it('should respect custom maxAgeMs', () => {
    const tenSecondsAgo = Math.floor(Date.now() / 1000) - 10;
    // 5 seconds window — too old
    expect(validateTimestamp(tenSecondsAgo, 5_000)).toBe(false);
    // 15 seconds window — within range
    expect(validateTimestamp(tenSecondsAgo, 15_000)).toBe(true);
  });
});
