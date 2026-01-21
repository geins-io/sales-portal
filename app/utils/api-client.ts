import type { FetchContext, FetchOptions, FetchResponse } from 'ofetch';

/**
 * HTTP methods that are safe to retry on failure
 * These methods are idempotent and don't have side effects
 */
const IDEMPOTENT_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'] as const;

/**
 * HTTP status codes that indicate a transient error worth retrying
 */
const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
] as const;

/**
 * Error types that are considered network errors and worth retrying
 */
const NETWORK_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETUNREACH',
  'ETIMEDOUT',
  'ERR_NETWORK',
] as const;

/**
 * Configuration options for the API client factory
 */
export interface ApiClientConfig {
  /**
   * Base URL for all requests
   * @example 'https://api.example.com' or '/api'
   */
  baseUrl?: string;

  /**
   * Number of retry attempts for failed requests
   * Only applies to idempotent methods (GET, HEAD, OPTIONS, PUT, DELETE)
   * Set to 0 to disable retries
   * @default 3
   */
  retry?: number;

  /**
   * Initial delay between retry attempts in milliseconds
   * Subsequent retries use exponential backoff (delay * 2^attempt)
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Maximum delay between retries in milliseconds
   * Prevents exponential backoff from growing too large
   * @default 30000
   */
  maxRetryDelay?: number;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Custom headers to include with every request
   */
  headers?: HeadersInit;

  /**
   * Whether to include credentials (cookies) with requests
   * @default 'same-origin'
   */
  credentials?: RequestCredentials;

  /**
   * Callback invoked before each request
   * Can be used to add authentication headers, log requests, etc.
   */
  onRequest?: (context: FetchContext) => void | Promise<void>;

  /**
   * Callback invoked after a successful response
   * Can be used to transform response data, log responses, etc.
   */
  onResponse?: (
    context: FetchContext & { response: FetchResponse<unknown> },
  ) => void | Promise<void>;

  /**
   * Callback invoked when a request fails (before retry)
   * Can be used to log errors, report metrics, etc.
   */
  onRequestError?: (
    context: FetchContext & { error: Error },
  ) => void | Promise<void>;

  /**
   * Callback invoked when a response error occurs (4xx/5xx)
   * Can be used to handle specific error codes, log errors, etc.
   */
  onResponseError?: (
    context: FetchContext & { response: FetchResponse<unknown> },
  ) => void | Promise<void>;

  /**
   * Custom function to determine if a request should be retried
   * If not provided, uses default retry logic based on method and status code
   */
  shouldRetry?: (
    error: Error,
    context: {
      attempt: number;
      method: string;
      statusCode?: number;
    },
  ) => boolean;
}

/**
 * Default configuration values for the API client
 */
export const DEFAULT_API_CLIENT_CONFIG: Required<
  Pick<
    ApiClientConfig,
    'retry' | 'retryDelay' | 'maxRetryDelay' | 'timeout' | 'credentials'
  >
> = {
  retry: 3,
  retryDelay: 1000,
  maxRetryDelay: 30000,
  timeout: 30000,
  credentials: 'same-origin',
};

/**
 * Extended fetch options with retry context
 */
interface ExtendedFetchOptions extends FetchOptions {
  _retryCount?: number;
}

/**
 * Determines if a method is safe to retry (idempotent)
 */
function isIdempotentMethod(method: string | undefined): boolean {
  if (!method) return true; // Default is GET, which is idempotent
  return IDEMPOTENT_METHODS.includes(
    method.toUpperCase() as (typeof IDEMPOTENT_METHODS)[number],
  );
}

/**
 * Determines if a status code indicates a retryable error
 */
function isRetryableStatusCode(statusCode: number | undefined): boolean {
  if (!statusCode) return false;
  return RETRYABLE_STATUS_CODES.includes(
    statusCode as (typeof RETRYABLE_STATUS_CODES)[number],
  );
}

/**
 * Determines if an error is a network error worth retrying
 */
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Check for common network error codes
  const errorCode = (error as Error & { code?: string }).code;
  if (
    errorCode &&
    NETWORK_ERROR_CODES.includes(
      errorCode as (typeof NETWORK_ERROR_CODES)[number],
    )
  ) {
    return true;
  }

  // Check for fetch abort errors (timeout)
  if (error.name === 'AbortError') {
    return true;
  }

  // Check error message for network-related terms
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('econnreset') ||
    message.includes('econnrefused')
  );
}

/**
 * Calculates the delay for a retry attempt using exponential backoff with jitter
 */
function calculateRetryDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  // Exponential backoff: delay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * (Math.random() * 0.5 - 0.25);

  // Clamp to max delay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Default retry decision function
 */
function defaultShouldRetry(
  error: Error,
  context: {
    attempt: number;
    method: string;
    statusCode?: number;
  },
): boolean {
  const { attempt, method, statusCode } = context;

  // Only retry idempotent methods
  if (!isIdempotentMethod(method)) {
    return false;
  }

  // Retry on retryable status codes
  if (statusCode && isRetryableStatusCode(statusCode)) {
    return true;
  }

  // Retry on network errors
  if (isNetworkError(error)) {
    return true;
  }

  // Don't retry client errors (4xx except specific codes)
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return false;
  }

  return false;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a configured fetch instance with retry logic and interceptors
 *
 * @example
 * ```typescript
 * const api = createApiClient({
 *   baseUrl: '/api',
 *   retry: 3,
 *   retryDelay: 1000,
 *   timeout: 30000,
 *   onRequest: ({ options }) => {
 *     options.headers = { ...options.headers, Authorization: 'Bearer token' };
 *   },
 *   onResponseError: ({ response }) => {
 *     if (response.status === 401) {
 *       // Handle authentication error
 *     }
 *   },
 * });
 *
 * // Use the client
 * const data = await api('/users', { method: 'GET' });
 * ```
 */
export function createApiClient(config: ApiClientConfig = {}) {
  const {
    baseUrl,
    retry = DEFAULT_API_CLIENT_CONFIG.retry,
    retryDelay = DEFAULT_API_CLIENT_CONFIG.retryDelay,
    maxRetryDelay = DEFAULT_API_CLIENT_CONFIG.maxRetryDelay,
    timeout = DEFAULT_API_CLIENT_CONFIG.timeout,
    headers: configHeaders,
    credentials = DEFAULT_API_CLIENT_CONFIG.credentials,
    onRequest: configOnRequest,
    onResponse: configOnResponse,
    onRequestError: configOnRequestError,
    onResponseError: configOnResponseError,
    shouldRetry = defaultShouldRetry,
  } = config;

  return $fetch.create({
    baseURL: baseUrl,
    timeout,
    credentials,
    headers: configHeaders,

    async onRequest(context) {
      // Initialize retry count
      const options = context.options as ExtendedFetchOptions;
      if (options._retryCount === undefined) {
        options._retryCount = 0;
      }

      // Call user's onRequest callback
      await configOnRequest?.(context);
    },

    async onResponse(context) {
      // Call user's onResponse callback
      await configOnResponse?.(context);
    },

    async onRequestError(context) {
      const { request, options, error } = context;
      const extendedOptions = options as ExtendedFetchOptions;
      const method =
        (options.method as string | undefined)?.toUpperCase() || 'GET';
      const currentAttempt = extendedOptions._retryCount ?? 0;

      // Call user's onRequestError callback
      await configOnRequestError?.(context);

      // Check if we should retry
      if (currentAttempt < retry) {
        const shouldRetryRequest = shouldRetry(error, {
          attempt: currentAttempt,
          method,
          statusCode: undefined,
        });

        if (shouldRetryRequest) {
          const delay = calculateRetryDelay(
            currentAttempt,
            retryDelay,
            maxRetryDelay,
          );

          // Log retry attempt (useful for debugging)
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              `[API Client] Request error, retrying (${currentAttempt + 1}/${retry}) after ${delay}ms:`,
              error.message,
            );
          }

          await sleep(delay);

          // Retry the request
          extendedOptions._retryCount = currentAttempt + 1;
          throw await $fetch(request, {
            ...options,
            baseURL: baseUrl,
            timeout,
            credentials,
            headers: configHeaders,
          });
        }
      }
    },

    async onResponseError(context) {
      const { request, options, response } = context;
      const extendedOptions = options as ExtendedFetchOptions;
      const method =
        (options.method as string | undefined)?.toUpperCase() || 'GET';
      const currentAttempt = extendedOptions._retryCount ?? 0;
      const statusCode = response?.status;

      // Call user's onResponseError callback
      await configOnResponseError?.(context);

      // Check if we should retry
      if (currentAttempt < retry && statusCode) {
        const error = new Error(`HTTP ${statusCode}: ${response?.statusText}`);
        const shouldRetryRequest = shouldRetry(error, {
          attempt: currentAttempt,
          method,
          statusCode,
        });

        if (shouldRetryRequest) {
          const delay = calculateRetryDelay(
            currentAttempt,
            retryDelay,
            maxRetryDelay,
          );

          // Log retry attempt
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              `[API Client] Response error ${statusCode}, retrying (${currentAttempt + 1}/${retry}) after ${delay}ms`,
            );
          }

          await sleep(delay);

          // Retry the request
          extendedOptions._retryCount = currentAttempt + 1;
          throw await $fetch(request, {
            ...options,
            baseURL: baseUrl,
            timeout,
            credentials,
            headers: configHeaders,
          });
        }
      }
    },
  });
}

/**
 * Type for the API client instance returned by createApiClient
 */
export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Utility to merge multiple header sources
 */
export function mergeHeaders(
  ...headerSources: (HeadersInit | undefined)[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const source of headerSources) {
    if (!source) continue;

    if (source instanceof Headers) {
      source.forEach((value, key) => {
        result[key] = value;
      });
    } else if (Array.isArray(source)) {
      for (const [key, value] of source) {
        result[key] = value;
      }
    } else {
      Object.assign(result, source);
    }
  }

  return result;
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return 'An unknown error occurred';
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'AbortError' ||
    error.message.toLowerCase().includes('timeout')
  );
}

/**
 * Check if an error is an HTTP error with a specific status code
 */
export function isHttpError(
  error: unknown,
  statusCode?: number,
): error is Error & { statusCode: number } {
  if (!(error instanceof Error)) return false;

  const errorWithStatus = error as Error & { statusCode?: number };

  if (statusCode !== undefined) {
    return errorWithStatus.statusCode === statusCode;
  }

  return typeof errorWithStatus.statusCode === 'number';
}
