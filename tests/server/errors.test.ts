import { describe, it, expect } from 'vitest';
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
  });

  describe('createTenantNotFoundError', () => {
    it('should create tenant not found error with hostname', () => {
      const error = createTenantNotFoundError('example.com');
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('example.com');
      expect(error.data?.code).toBe(ErrorCode.TENANT_NOT_FOUND);
    });
  });

  describe('createTenantInactiveError', () => {
    it('should create tenant inactive error with tenant ID', () => {
      const error = createTenantInactiveError('tenant-123');
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('tenant-123');
      expect(error.data?.code).toBe(ErrorCode.TENANT_INACTIVE);
    });
  });

  describe('createValidationError', () => {
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
