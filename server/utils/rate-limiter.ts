import type { H3Event } from 'h3';
import { getHeader } from 'h3';

/**
 * Rate limiter configuration options
 */
export interface RateLimiterOptions {
  /** Maximum number of requests allowed within the time window */
  limit: number;
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs: number;
  /** Storage key prefix for this limiter instance */
  prefix: string;
}

/**
 * Rate limiter result
 */
export interface RateLimitResult {
  /** Whether the request should be allowed */
  allowed: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Timestamp when the rate limit will reset */
  resetTime: number;
}

/**
 * KV-backed rate limiter for protecting endpoints from abuse.
 *
 * Uses a sliding window approach to track requests per IP address.
 * Backed by Nitro's `useStorage('kv')` — uses in-memory storage in dev
 * and automatically scales to Redis/Upstash when the KV driver is changed.
 * This means rate limiting works across multiple instances when using
 * a shared storage backend.
 */
export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly prefix: string;

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.prefix = options.prefix;
  }

  private storageKey(key: string): string {
    return `rate-limit:${this.prefix}:${key}`;
  }

  /**
   * Check if a request should be rate limited
   * @param key - The identifier for rate limiting (typically IP address)
   * @returns Rate limit result with allowed status and metadata
   */
  async check(key: string): Promise<RateLimitResult> {
    const storage = useStorage('kv');
    const storageKey = this.storageKey(key);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing timestamps from KV
    const existingTimestamps =
      (await storage.getItem<number[]>(storageKey)) || [];

    // Filter to only requests within the current window
    const recentRequests = existingTimestamps.filter((t) => t > windowStart);

    // Check if rate limit exceeded
    if (recentRequests.length >= this.limit) {
      const oldestRequest = Math.min(...recentRequests);
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestRequest + this.windowMs,
      };
    }

    // Add current request timestamp and persist
    recentRequests.push(now);
    await storage.setItem(storageKey, recentRequests);

    return {
      allowed: true,
      remaining: this.limit - recentRequests.length,
      resetTime: now + this.windowMs,
    };
  }

  /**
   * Reset the rate limiter for a specific key (useful for testing)
   */
  async reset(key?: string): Promise<void> {
    const storage = useStorage('kv');
    if (key) {
      await storage.removeItem(this.storageKey(key));
    } else {
      // Clear all keys with this prefix
      const keys = await storage.getKeys(`rate-limit:${this.prefix}`);
      await Promise.all(keys.map((k) => storage.removeItem(k)));
    }
  }

  /**
   * Get current request count for a key (useful for debugging)
   */
  async getRequestCount(key: string): Promise<number> {
    const storage = useStorage('kv');
    const timestamps =
      (await storage.getItem<number[]>(this.storageKey(key))) || [];
    const windowStart = Date.now() - this.windowMs;
    return timestamps.filter((t) => t > windowStart).length;
  }
}

/**
 * Extract client IP address from an H3 event
 *
 * Checks common proxy headers first, then falls back to the direct connection IP.
 * The order of header checks follows common proxy/CDN conventions.
 */
export function getClientIp(event: H3Event): string {
  // Check X-Forwarded-For header (most common proxy header)
  const forwardedFor = getHeader(event, 'x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs; the first is the client
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  // Check X-Real-IP header (used by Nginx)
  const realIp = getHeader(event, 'x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Check CF-Connecting-IP header (used by Cloudflare)
  const cfIp = getHeader(event, 'cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }

  // Fall back to the direct connection address
  const nodeReq = event.node?.req;
  if (nodeReq?.socket?.remoteAddress) {
    return nodeReq.socket.remoteAddress;
  }

  // Ultimate fallback
  return 'unknown';
}

// --- Pre-configured rate limiter instances ---

export const errorEndpointRateLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60000,
  prefix: 'error-batch',
});

export const loginRateLimiter = new RateLimiter({
  limit: 5,
  windowMs: 60000,
  prefix: 'auth-login',
});

export const registerRateLimiter = new RateLimiter({
  limit: 3,
  windowMs: 60000,
  prefix: 'auth-register',
});

export const refreshRateLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60000,
  prefix: 'auth-refresh',
});
