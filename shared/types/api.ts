/**
 * API Response Types
 *
 * Standardized types for API responses across the application.
 */

/**
 * Re-export API client types for convenience
 */
export type {
  ApiClientConfig,
  ApiClient,
} from '../../app/utils/api-client';

export {
  DEFAULT_API_CLIENT_CONFIG,
  createApiClient,
  mergeHeaders,
  getErrorMessage,
  isTimeoutError,
  isHttpError,
} from '../../app/utils/api-client';

/**
 * Base API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;
  /** Whether the request was successful */
  success: boolean;
  /** Optional message */
  message?: string;
  /** Response timestamp */
  timestamp?: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  /** Whether the request was successful (always false for errors) */
  success: false;
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Detailed error information */
  details?: Record<string, unknown>;
  /** Validation errors (for 422 responses) */
  validationErrors?: Record<string, string[]>;
  /** Error timestamp */
  timestamp?: string;
}

/**
 * Pagination parameters for list requests
 */
export interface PaginationParams {
  /** Current page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** Pagination metadata */
  pagination: PaginationMeta;
}

/**
 * Filter parameters for list requests
 */
export interface FilterParams {
  /** Search query */
  search?: string;
  /** Filter criteria */
  filters?: Record<string, string | number | boolean | string[]>;
  /** Date range filter */
  dateRange?: {
    start?: string;
    end?: string;
  };
}

/**
 * Combined list request parameters
 */
export interface ListParams extends PaginationParams, FilterParams {}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  /** Service status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Service version */
  version: string;
  /** Git commit SHA */
  commitSha?: string;
  /** Uptime in seconds */
  uptime: number;
  /** Individual service checks */
  checks?: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }[];
}
