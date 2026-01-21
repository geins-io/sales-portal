import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, getClientIp } from '../../server/utils/rate-limiter';
import type { H3Event } from 'h3';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    rateLimiter = new RateLimiter({
      limit: 3,
      windowMs: 60000, // 1 minute
    });
  });

  afterEach(() => {
    rateLimiter.destroy();
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should allow requests under the limit', () => {
      const result1 = rateLimiter.check('192.168.1.1');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = rateLimiter.check('192.168.1.1');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = rateLimiter.check('192.168.1.1');
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests over the limit', () => {
      // Make 3 requests (the limit)
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');

      // 4th request should be blocked
      const result = rateLimiter.check('192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different IPs separately', () => {
      // Max out first IP
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');

      // Second IP should still be allowed
      const result = rateLimiter.check('192.168.1.2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should reset after the time window', () => {
      // Max out the limit
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');

      // Verify blocked
      const blockedResult = rateLimiter.check('192.168.1.1');
      expect(blockedResult.allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(60001);

      // Should be allowed again
      const result = rateLimiter.check('192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should provide correct reset time', () => {
      const now = Date.now();
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');

      const result = rateLimiter.check('192.168.1.1');
      expect(result.resetTime).toBeGreaterThan(now);
      expect(result.resetTime).toBeLessThanOrEqual(now + 60000);
    });

    it('should use sliding window correctly', () => {
      // Make first request at t=0
      rateLimiter.check('192.168.1.1');

      // Advance 30 seconds
      vi.advanceTimersByTime(30000);

      // Make 2 more requests at t=30s
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');

      // Should be blocked now (3 requests in last 60s)
      const blockedResult = rateLimiter.check('192.168.1.1');
      expect(blockedResult.allowed).toBe(false);

      // Advance 31 seconds (first request now outside window)
      vi.advanceTimersByTime(31000);

      // Should be allowed again (only 2 requests in last 60s)
      const allowedResult = rateLimiter.check('192.168.1.1');
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe('getRequestCount', () => {
    it('should return current request count', () => {
      expect(rateLimiter.getRequestCount('192.168.1.1')).toBe(0);

      rateLimiter.check('192.168.1.1');
      expect(rateLimiter.getRequestCount('192.168.1.1')).toBe(1);

      rateLimiter.check('192.168.1.1');
      expect(rateLimiter.getRequestCount('192.168.1.1')).toBe(2);
    });

    it('should not count expired requests', () => {
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');

      vi.advanceTimersByTime(60001);

      expect(rateLimiter.getRequestCount('192.168.1.1')).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all tracked requests', () => {
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.1');
      rateLimiter.check('192.168.1.2');

      rateLimiter.reset();

      expect(rateLimiter.getRequestCount('192.168.1.1')).toBe(0);
      expect(rateLimiter.getRequestCount('192.168.1.2')).toBe(0);
    });
  });
});

describe('getClientIp', () => {
  function createMockEvent(
    headers: Record<string, string | undefined>,
    remoteAddress?: string,
  ): H3Event {
    return {
      node: {
        req: {
          headers: Object.fromEntries(
            Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
          ),
          socket: {
            remoteAddress,
          },
        },
        res: {},
      },
      context: {},
    } as unknown as H3Event;
  }

  it('should extract IP from x-forwarded-for header', () => {
    const event = createMockEvent(
      { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.195');
  });

  it('should extract single IP from x-forwarded-for header', () => {
    const event = createMockEvent(
      { 'x-forwarded-for': '203.0.113.195' },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.195');
  });

  it('should extract IP from x-real-ip header', () => {
    const event = createMockEvent({ 'x-real-ip': '203.0.113.50' }, '127.0.0.1');

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.50');
  });

  it('should extract IP from cf-connecting-ip header', () => {
    const event = createMockEvent(
      { 'cf-connecting-ip': '203.0.113.100' },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.100');
  });

  it('should prefer x-forwarded-for over other headers', () => {
    const event = createMockEvent(
      {
        'x-forwarded-for': '203.0.113.195',
        'x-real-ip': '203.0.113.50',
        'cf-connecting-ip': '203.0.113.100',
      },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.195');
  });

  it('should fall back to remote address when no proxy headers', () => {
    const event = createMockEvent({}, '192.168.1.100');

    const ip = getClientIp(event);
    expect(ip).toBe('192.168.1.100');
  });

  it('should return unknown when no IP can be determined', () => {
    const event = createMockEvent({}, undefined);

    const ip = getClientIp(event);
    expect(ip).toBe('unknown');
  });

  it('should handle whitespace in headers', () => {
    const event = createMockEvent(
      { 'x-forwarded-for': '  203.0.113.195  ,  70.41.3.18  ' },
      '127.0.0.1',
    );

    const ip = getClientIp(event);
    expect(ip).toBe('203.0.113.195');
  });
});
