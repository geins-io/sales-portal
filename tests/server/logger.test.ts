import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  createTenantLogger,
  createRequestLogger,
  generateCorrelationId,
  parseCorrelationIdFromHeaders,
  createTimer,
  safeStringify,
} from '../../server/utils/logger';

describe('Logger utilities', () => {
  beforeEach(() => {
    // Reset environment
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('LOG_LEVEL', 'debug');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('createLogger', () => {
    it('should create a logger with all methods', () => {
      const logger = createLogger();

      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('trackMetric');
      expect(logger).toHaveProperty('trackEvent');
      expect(logger).toHaveProperty('trackDependency');
      expect(logger).toHaveProperty('child');
      expect(logger).toHaveProperty('getCorrelationId');
    });

    it('should create child logger with merged context', () => {
      const parentLogger = createLogger({ hostname: 'tenant-1.example.com' });
      const childLogger = parentLogger.child({ requestId: 'req-1' });

      expect(childLogger).toBeDefined();
      expect(childLogger).toHaveProperty('debug');
    });

    it('should return correlation ID from context', () => {
      const logger = createLogger({ correlationId: 'test-cid' });
      expect(logger.getCorrelationId()).toBe('test-cid');
    });

    it('should return undefined for correlation ID when not set', () => {
      const logger = createLogger();
      expect(logger.getCorrelationId()).toBeUndefined();
    });
  });

  describe('createTenantLogger', () => {
    it('should create a logger with hostname context', () => {
      const logger = createTenantLogger('tenant-123.example.com');

      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('info');
    });
  });

  describe('createRequestLogger', () => {
    it('should create a logger with correlation ID', () => {
      const logger = createRequestLogger('test-correlation-id');

      expect(logger.getCorrelationId()).toBe('test-correlation-id');
    });

    it('should generate correlation ID when not provided', () => {
      const logger = createRequestLogger();

      expect(logger.getCorrelationId()).toBeDefined();
      expect(logger.getCorrelationId()).toHaveLength(36); // UUID length
    });

    it('should include additional context', () => {
      const logger = createRequestLogger('cid', {
        hostname: 'tenant-1.example.com',
        path: '/api/test',
      });

      expect(logger.getCorrelationId()).toBe('cid');
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate a valid UUID', () => {
      const id = generateCorrelationId();

      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate unique IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('parseCorrelationIdFromHeaders', () => {
    it('should extract x-correlation-id header', () => {
      const headers = { 'x-correlation-id': 'test-cid-123' };
      expect(parseCorrelationIdFromHeaders(headers)).toBe('test-cid-123');
    });

    it('should extract x-request-id header', () => {
      const headers = { 'x-request-id': 'test-req-id' };
      expect(parseCorrelationIdFromHeaders(headers)).toBe('test-req-id');
    });

    it('should extract request-id header', () => {
      const headers = { 'request-id': 'req-id-456' };
      expect(parseCorrelationIdFromHeaders(headers)).toBe('req-id-456');
    });

    it('should extract trace ID from traceparent header', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      };
      expect(parseCorrelationIdFromHeaders(headers)).toBe(
        '0af7651916cd43dd8448eb211c80319c',
      );
    });

    it('should prefer x-correlation-id over other headers', () => {
      const headers = {
        'x-correlation-id': 'preferred-id',
        'x-request-id': 'other-id',
        traceparent: '00-traceid-parentid-01',
      };
      expect(parseCorrelationIdFromHeaders(headers)).toBe('preferred-id');
    });

    it('should return undefined when no correlation headers present', () => {
      const headers = { 'content-type': 'application/json' };
      expect(parseCorrelationIdFromHeaders(headers)).toBeUndefined();
    });

    it('should handle array header values', () => {
      const headers = { 'x-correlation-id': ['first-value', 'second-value'] };
      expect(parseCorrelationIdFromHeaders(headers)).toBe('first-value');
    });
  });

  describe('createTimer', () => {
    it('should measure elapsed time', async () => {
      const timer = createTimer();

      // Wait a small amount of time
      // Note: setTimeout is not precise, can fire slightly early
      await new Promise((resolve) => setTimeout(resolve, 15));

      const elapsed = timer.elapsed();
      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(elapsed).toBeLessThan(100); // Should be quick
    });

    it('should return integer milliseconds', () => {
      const timer = createTimer();
      const elapsed = timer.elapsed();

      expect(Number.isInteger(elapsed)).toBe(true);
    });
  });

  describe('safeStringify', () => {
    it('should stringify simple objects', () => {
      const obj = { name: 'test', value: 123 };
      expect(safeStringify(obj)).toBe('{"name":"test","value":123}');
    });

    it('should truncate long strings', () => {
      const obj = { data: 'a'.repeat(2000) };
      const result = safeStringify(obj, 100);

      expect(result.length).toBeLessThanOrEqual(117); // 100 + '... [truncated]'
      expect(result).toContain('... [truncated]');
    });

    it('should handle circular references', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;

      const result = safeStringify(obj);
      expect(result).toBe('[Unable to stringify]');
    });

    it('should handle null and undefined', () => {
      expect(safeStringify(null)).toBe('null');
      // undefined becomes undefined string in JSON
    });
  });
});
