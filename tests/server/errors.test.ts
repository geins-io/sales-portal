import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorCode,
  createAppError,
  createTenantNotFoundError,
  createTenantInactiveError,
  createValidationError,
} from '../../server/utils/errors';

describe('Error utilities', () => {
  describe('ErrorCode enum', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCode.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.TENANT_NOT_FOUND).toBe('TENANT_NOT_FOUND');
      expect(ErrorCode.TENANT_INACTIVE).toBe('TENANT_INACTIVE');
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });
  });

  describe('createAppError', () => {
    it('should create error with correct status code for NOT_FOUND', () => {
      const error = createAppError(ErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(404);
    });

    it('should create error with correct status code for BAD_REQUEST', () => {
      const error = createAppError(ErrorCode.BAD_REQUEST);
      expect(error.statusCode).toBe(400);
    });

    it('should create error with correct status code for INTERNAL_ERROR', () => {
      const error = createAppError(ErrorCode.INTERNAL_ERROR);
      expect(error.statusCode).toBe(500);
    });

    describe('in development mode', () => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'development');
      });

      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('should use custom message when provided', () => {
        const error = createAppError(ErrorCode.NOT_FOUND, 'Custom message');
        expect(error.message).toBe('Custom message');
      });

      it('should include details in error data', () => {
        const error = createAppError(ErrorCode.NOT_FOUND, 'Not found', {
          resourceId: '123',
        });
        expect(error.data?.details?.resourceId).toBe('123');
      });

      it('should include sensitive information in tenant errors', () => {
        const error = createTenantNotFoundError('secret-internal.example.com');
        expect(error.message).toContain('secret-internal.example.com');
        expect(error.data?.details?.hostname).toBe(
          'secret-internal.example.com',
        );
      });
    });

    describe('in production mode', () => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'production');
      });

      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('should use generic error message instead of custom message', () => {
        const error = createAppError(
          ErrorCode.NOT_FOUND,
          'Secret internal path: /admin/users/123',
        );
        expect(error.message).toBe('Resource not found');
        expect(error.message).not.toContain('Secret');
        expect(error.message).not.toContain('/admin');
      });

      it('should strip details from error data', () => {
        const error = createAppError(ErrorCode.NOT_FOUND, 'Not found', {
          resourceId: '123',
          internalPath: '/secret/path',
        });
        expect(error.data?.code).toBe(ErrorCode.NOT_FOUND);
        expect(error.data?.details).toBeUndefined();
      });

      it('should sanitize tenant not found errors', () => {
        const error = createTenantNotFoundError('secret-internal.example.com');
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Tenant not found');
        expect(error.message).not.toContain('secret-internal.example.com');
        expect(error.data?.details).toBeUndefined();
      });

      it('should sanitize tenant inactive errors', () => {
        const error = createTenantInactiveError('tenant-secret-123');
        expect(error.statusCode).toBe(403);
        expect(error.message).toBe('Tenant is inactive');
        expect(error.message).not.toContain('tenant-secret-123');
        expect(error.data?.details).toBeUndefined();
      });

      it('should sanitize validation errors', () => {
        const error = createValidationError('Internal validation failed', {
          email: ['Invalid email format'],
          secretField: ['Secret validation error'],
        });
        expect(error.statusCode).toBe(422);
        expect(error.message).toBe('Validation failed');
        expect(error.message).not.toContain('Internal');
        expect(error.data?.details).toBeUndefined();
      });

      it('should always include error code in response', () => {
        const error = createAppError(
          ErrorCode.INTERNAL_ERROR,
          'Database connection failed: connection string leaked',
          { connectionString: 'postgres://user:pass@host:5432/db' },
        );
        expect(error.data?.code).toBe(ErrorCode.INTERNAL_ERROR);
        expect(error.message).toBe('Internal server error');
        expect(error.message).not.toContain('Database');
        expect(error.data?.details).toBeUndefined();
      });
    });
  });

  describe('createTenantNotFoundError', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should create tenant not found error with hostname', () => {
      const error = createTenantNotFoundError('example.com');
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('example.com');
      expect(error.data?.code).toBe(ErrorCode.TENANT_NOT_FOUND);
    });
  });

  describe('createTenantInactiveError', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should create tenant inactive error with tenant ID', () => {
      const error = createTenantInactiveError('tenant-123');
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('tenant-123');
      expect(error.data?.code).toBe(ErrorCode.TENANT_INACTIVE);
    });
  });

  describe('createValidationError', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should create validation error with field errors', () => {
      const error = createValidationError('Validation failed', {
        email: ['Invalid email format'],
        password: ['Password too short'],
      });
      expect(error.statusCode).toBe(422);
      expect(error.data?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.data?.details?.validationErrors).toHaveProperty('email');
      expect(error.data?.details?.validationErrors).toHaveProperty('password');
    });
  });
});
