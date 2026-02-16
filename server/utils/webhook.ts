import { createHmac, timingSafeEqual } from 'node:crypto';

/** Maximum webhook body size in bytes (64 KB) */
export const MAX_WEBHOOK_BODY_SIZE = 65_536;

/**
 * Parse a Stripe-style signature header: `t=<unix_seconds>,v1=<hex_hmac>`
 * Returns null if the format is invalid.
 */
export function parseSignatureHeader(
  header: string,
): { timestamp: number; signature: string } | null {
  if (!header) return null;

  const parts = header.split(',');
  let timestamp: number | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === 't' && value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      timestamp = parsed;
    } else if (key === 'v1' && value) {
      signature = value;
    }
  }

  if (timestamp === undefined || !signature) return null;

  return { timestamp, signature };
}

/**
 * Parse comma-separated secrets from an env value.
 * Trims whitespace and filters empty entries.
 */
export function parseSecrets(envValue: string): string[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Compute HMAC-SHA256 of a signed payload and return the hex digest.
 */
export function computeHmacHex(signedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(signedPayload).digest('hex');
}

/**
 * Verify a signature against a single secret using timing-safe comparison.
 */
export function verifySignature(
  signedPayload: string,
  receivedHex: string,
  secret: string,
): boolean {
  const expectedHex = computeHmacHex(signedPayload, secret);

  const receivedBuf = Buffer.from(receivedHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  if (receivedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(receivedBuf, expectedBuf);
}

/**
 * Try each secret in order, return true on first match.
 * Supports key rotation: `NUXT_WEBHOOK_SECRET=current_key,old_key`
 */
export function verifyWithSecrets(
  signedPayload: string,
  receivedHex: string,
  secrets: string[],
): boolean {
  for (const secret of secrets) {
    if (verifySignature(signedPayload, receivedHex, secret)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate that a timestamp is not stale (replay protection).
 * @param timestamp - Unix timestamp in seconds
 * @param maxAgeMs - Maximum acceptable age in milliseconds (default: 5 minutes)
 * @returns true if the timestamp is fresh enough
 */
export function validateTimestamp(
  timestamp: unknown,
  maxAgeMs: number = 5 * 60 * 1000,
): boolean {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return false;
  }

  const now = Date.now();
  const timestampMs = timestamp * 1000;
  const age = now - timestampMs;

  return age >= 0 && age <= maxAgeMs;
}
