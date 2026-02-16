import { H3Error, createError } from 'h3';
import { logger } from './logger';

/**
 * Error codes for the Sales Portal
 */
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  CONFLICT = 'CONFLICT',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  TENANT_INACTIVE = 'TENANT_INACTIVE',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
}

/**
 * HTTP status codes for error codes
 */
const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.TENANT_NOT_FOUND]: 404,
  [ErrorCode.TENANT_INACTIVE]: 403,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.EXTERNAL_API_ERROR]: 502,
  [ErrorCode.STORAGE_ERROR]: 500,
};

/**
 * Default error messages
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.BAD_REQUEST]: 'Bad request',
  [ErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ErrorCode.FORBIDDEN]: 'Access denied',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.RATE_LIMITED]: 'Too many requests',
  [ErrorCode.CONFLICT]: 'Already processed',
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'Payload too large',
  [ErrorCode.VALIDATION_ERROR]: 'Validation failed',
  [ErrorCode.TENANT_NOT_FOUND]: 'Tenant not found',
  [ErrorCode.TENANT_INACTIVE]: 'Tenant is inactive',
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  [ErrorCode.EXTERNAL_API_ERROR]: 'External API error',
  [ErrorCode.STORAGE_ERROR]: 'Storage error',
};

/**
 * Extended error data interface
 */
export interface ErrorData {
  code: ErrorCode;
  details?: Record<string, unknown>;
  tenantId?: string;
}

/**
 * Create an application error
 *
 * In production, error messages and details are sanitized to prevent
 * information leakage. The full details are always logged server-side.
 */
export function createAppError(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>,
): H3Error {
  const isDev = process.env.NODE_ENV === 'development';
  const statusCode = ERROR_STATUS_CODES[code];
  const internalMessage = message || ERROR_MESSAGES[code];
  // In production, always use generic messages to prevent information leakage
  const publicMessage = isDev ? internalMessage : ERROR_MESSAGES[code];

  // Always log the full error details server-side
  if (statusCode >= 500) {
    logger.error(`Server error: ${internalMessage}`, undefined, {
      code,
      ...details,
    });
  } else {
    logger.warn(`Client error: ${internalMessage}`, { code, ...details });
  }

  return createError({
    statusCode,
    statusMessage: publicMessage,
    message: publicMessage,
    // In production, strip internal details from response
    data: isDev ? { code, details } : { code },
  });
}

/**
 * Create a tenant not found error
 */
export function createTenantNotFoundError(hostname: string): H3Error {
  return createAppError(
    ErrorCode.TENANT_NOT_FOUND,
    `No tenant configured for hostname: ${hostname}`,
    { hostname },
  );
}

/**
 * Create a tenant inactive error
 */
export function createTenantInactiveError(tenantId: string): H3Error {
  return createAppError(
    ErrorCode.TENANT_INACTIVE,
    `Tenant is inactive: ${tenantId}`,
    { tenantId },
  );
}

/**
 * Create a validation error
 */
export function createValidationError(
  message: string,
  errors: Record<string, string[]>,
): H3Error {
  return createAppError(ErrorCode.VALIDATION_ERROR, message, {
    validationErrors: errors,
  });
}

/**
 * Create an external API error
 */
export function createExternalApiError(
  service: string,
  originalError?: Error,
): H3Error {
  return createAppError(
    ErrorCode.EXTERNAL_API_ERROR,
    `Error communicating with ${service}`,
    {
      service,
      originalMessage: originalError?.message,
    },
  );
}

/**
 * Create a storage error
 */
export function createStorageError(
  operation: string,
  originalError?: Error,
): H3Error {
  return createAppError(
    ErrorCode.STORAGE_ERROR,
    `Storage ${operation} failed`,
    {
      operation,
      originalMessage: originalError?.message,
    },
  );
}

/**
 * Wrap an async handler with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<T>,
  context?: { tenantId?: string; operation?: string },
): Promise<T> {
  return handler().catch((error) => {
    // If it's already an H3Error, re-throw it
    if (error instanceof H3Error) {
      throw error;
    }

    // Log the unexpected error
    logger.error(
      `Unexpected error${context?.operation ? ` during ${context.operation}` : ''}`,
      error instanceof Error ? error : new Error(String(error)),
      context,
    );

    // Throw a generic internal error
    throw createAppError(
      ErrorCode.INTERNAL_ERROR,
      'An unexpected error occurred',
    );
  });
}
