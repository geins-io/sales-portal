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
 * In-memory rate limiter for protecting endpoints from abuse
 *
 * Uses a sliding window approach to track requests per IP address.
 * Note: This is designed for single-instance deployments. For distributed
 * systems, consider using Redis or another shared store.
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly limit: number;
  private readonly windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;

    // Periodically clean up expired entries to prevent memory leaks
    // Use unref() to allow the process to exit cleanly (important for tests and serverless)
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs * 2);
    this.cleanupInterval.unref();
  }

  /**
   * Check if a request should be rate limited
   * @param key - The identifier for rate limiting (typically IP address)
   * @returns Rate limit result with allowed status and metadata
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this key
    const existingRequests = this.requests.get(key) || [];

    // Filter to only requests within the current window
    const recentRequests = existingRequests.filter((t) => t > windowStart);

    // Check if rate limit exceeded
    if (recentRequests.length >= this.limit) {
      const oldestRequest = Math.min(...recentRequests);
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestRequest + this.windowMs,
      };
    }

    // Add current request timestamp
    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    return {
      allowed: true,
      remaining: this.limit - recentRequests.length,
      resetTime: now + this.windowMs,
    };
  }

  /**
   * Clean up expired entries from the rate limiter
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter((t) => t > windowStart);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }

  /**
   * Stop the cleanup interval (for testing or shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requests.clear();
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  reset(): void {
    this.requests.clear();
  }

  /**
   * Get current request count for a key (useful for debugging)
   */
  getRequestCount(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const requests = this.requests.get(key) || [];
    return requests.filter((t) => t > windowStart).length;
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
  // Note: In H3/Nitro, we need to access the node's socket
  const nodeReq = event.node?.req;
  if (nodeReq?.socket?.remoteAddress) {
    return nodeReq.socket.remoteAddress;
  }

  // Ultimate fallback
  return 'unknown';
}

// Default rate limiter for error endpoint: 10 requests per minute per IP
export const errorEndpointRateLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60000, // 1 minute
});
