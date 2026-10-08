import { H3Error, createError } from 'h3';
import { logger } from './logger';
import { describeSdkError, isSdkClientFault } from './sdk-error';

/**
 * Error codes for the Sales Portal
 */
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  CONFLICT = 'CONFLICT',
  EMPTY_CART = 'EMPTY_CART',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  GONE = 'GONE',
  /** A cart line named for an edit is not in the cart, or carries no configuration. */
  CART_LINE_GONE = 'CART_LINE_GONE',
  /** The cart named is another company's. */
  CART_NOT_OWN = 'CART_NOT_OWN',
  /** The cart is read only with the buyer signed in. */
  CART_LOGIN_REQUIRED = 'CART_LOGIN_REQUIRED',
  /** The account has no configurator (CPQ) behind it. */
  CONFIGURATOR_NOT_AVAILABLE = 'CONFIGURATOR_NOT_AVAILABLE',
  /** A configuration priced in another currency than the buyer's market. */
  CURRENCY_MISMATCH = 'CURRENCY_MISMATCH',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  TENANT_INACTIVE = 'TENANT_INACTIVE',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
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
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.CONFLICT]: 409,
  // 409 rather than 400: the same endpoint answers 400 when order creation
  // itself fails, so the status alone tells the two apart.
  [ErrorCode.EMPTY_CART]: 409,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.GONE]: 410,
  // Their own codes rather than 404 and 403: the page tells a line it cannot
  // edit from an unknown configuration or a buyer the provider refuses by code.
  [ErrorCode.CART_LINE_GONE]: 404,
  [ErrorCode.CART_NOT_OWN]: 403,
  // Not UNAUTHORIZED: the client keeps the cart id for this code alone.
  [ErrorCode.CART_LOGIN_REQUIRED]: 401,
  // As the configurator flag turned off: setup, not an outage.
  [ErrorCode.CONFIGURATOR_NOT_AVAILABLE]: 404,
  // Not 422 or 410, which the page reads as a refused change or an expiry.
  [ErrorCode.CURRENCY_MISMATCH]: 409,
  [ErrorCode.TENANT_NOT_FOUND]: 404,
  [ErrorCode.TENANT_INACTIVE]: 403,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
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
  [ErrorCode.SESSION_EXPIRED]: 'Session expired',
  [ErrorCode.FORBIDDEN]: 'Access denied',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.RATE_LIMITED]: 'Too many requests',
  [ErrorCode.CONFLICT]: 'Already processed',
  [ErrorCode.EMPTY_CART]: 'Cart has no items',
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'Payload too large',
  [ErrorCode.VALIDATION_ERROR]: 'Validation failed',
  [ErrorCode.GONE]: 'Resource is no longer available',
  [ErrorCode.CART_LINE_GONE]: 'Cart line not found',
  [ErrorCode.CART_NOT_OWN]: 'Cart belongs to another company',
  [ErrorCode.CART_LOGIN_REQUIRED]: 'Sign in to read this cart',
  [ErrorCode.CONFIGURATOR_NOT_AVAILABLE]: 'The configurator is not available',
  [ErrorCode.CURRENCY_MISMATCH]: 'Priced in another currency',
  [ErrorCode.TENANT_NOT_FOUND]: 'Tenant not found',
  [ErrorCode.TENANT_INACTIVE]: 'Tenant is inactive',
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.NOT_IMPLEMENTED]: 'Not implemented',
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
  cause?: unknown,
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
    // Not serialised into the response; Sentry links it as the chained error.
    cause,
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
  details?: Record<string, unknown>,
): H3Error {
  return createAppError(
    ErrorCode.EXTERNAL_API_ERROR,
    `Error communicating with ${service}`,
    {
      service,
      originalMessage: originalError?.message,
      ...details,
    },
    originalError,
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
 * Wrap a service call with standardized error handling.
 * Re-throws H3Errors. At a site that names a `knownError`, an SDK error whose
 * code shows a client fault maps to `errorCode`; everything else becomes
 * EXTERNAL_API_ERROR. The SDK error's code and cause are logged either way.
 * `knownError` only opts the site in: the SDK's ES5 build breaks `instanceof`.
 */
export async function wrapServiceCall<T>(
  fn: () => Promise<T>,
  service: string,
  knownError?: new (...args: never[]) => Error,
  errorCode: ErrorCode = ErrorCode.BAD_REQUEST,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof H3Error) {
      throw error;
    }
    const sdkError = describeSdkError(error);
    if (knownError && isSdkClientFault(error)) {
      throw createAppError(
        errorCode,
        error instanceof Error ? error.message : undefined,
        { service, sdkError },
      );
    }
    throw createExternalApiError(
      service,
      error instanceof Error ? error : undefined,
      { sdkError },
    );
  }
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
