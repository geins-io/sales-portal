/**
 * Application Constants
 *
 * Centralized constants and configuration values used throughout the application.
 */

// Re-export server-side storage constants
export { KV_STORAGE_KEYS, type KvStorageKeys } from './storage';

/**
 * Application metadata
 */
export const APP = {
  NAME: 'Sales Portal',
  VERSION: '1.0.0',
  DESCRIPTION: 'Multi-tenant storefront application',
} as const;

/**
 * API configuration defaults
 */
export const API = {
  /** Default request timeout in milliseconds */
  DEFAULT_TIMEOUT: 30000,
  /** Default page size for paginated requests */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum page size allowed */
  MAX_PAGE_SIZE: 100,
  /** Cache duration in seconds */
  CACHE_DURATION: 3600,
} as const;

/**
 * Storage keys for localStorage/sessionStorage
 */
export const STORAGE_KEYS = {
  /** User theme preference */
  THEME: 'app-theme',
  /** Authentication token */
  AUTH_TOKEN: 'auth-token',
  /** User preferences */
  USER_PREFERENCES: 'user-preferences',
  /** Recently viewed items */
  RECENTLY_VIEWED: 'recently-viewed',
  /** Cart data */
  CART: 'cart-data',
  /** Wishlist data */
  WISHLIST: 'wishlist-data',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Route paths
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/products/:id',
  CART: '/cart',
  CHECKOUT: '/checkout',
  ACCOUNT: '/account',
  ACCOUNT_ORDERS: '/account/orders',
  ACCOUNT_PROFILE: '/account/profile',
  ACCOUNT_ADDRESSES: '/account/addresses',
  SEARCH: '/search',
  CATEGORIES: '/categories',
} as const;

/**
 * Breakpoints (matching Tailwind defaults)
 */
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

/**
 * Animation durations in milliseconds
 */
export const ANIMATION = {
  FAST: 150,
  DEFAULT: 200,
  SLOW: 300,
  VERY_SLOW: 500,
} as const;

/**
 * Date format strings
 */
export const DATE_FORMATS = {
  /** ISO format: 2024-01-15 */
  ISO: 'YYYY-MM-DD',
  /** Short date: 15 Jan 2024 */
  SHORT: 'DD MMM YYYY',
  /** Long date: January 15, 2024 */
  LONG: 'MMMM DD, YYYY',
  /** Date and time: 15 Jan 2024, 14:30 */
  DATETIME: 'DD MMM YYYY, HH:mm',
  /** Time only: 14:30 */
  TIME: 'HH:mm',
} as const;

/**
 * Validation constants
 */
export const VALIDATION = {
  /** Minimum password length */
  PASSWORD_MIN_LENGTH: 8,
  /** Maximum password length */
  PASSWORD_MAX_LENGTH: 128,
  /** Minimum username length */
  USERNAME_MIN_LENGTH: 3,
  /** Maximum username length */
  USERNAME_MAX_LENGTH: 50,
  /** Maximum file upload size in bytes (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Allowed image MIME types */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

/**
 * Currency configuration
 */
export const CURRENCY = {
  /** Default currency code */
  DEFAULT: 'SEK',
  /** Currency symbols */
  SYMBOLS: {
    SEK: 'kr',
    EUR: '€',
    USD: '$',
    GBP: '£',
    NOK: 'kr',
    DKK: 'kr',
  } as Record<string, string>,
} as const;

/**
 * Feature flags default values
 */
export const DEFAULT_FEATURES = {
  DARK_MODE: true,
  SEARCH: true,
  AUTHENTICATION: true,
  CART: true,
  WISHLIST: false,
  PRODUCT_COMPARISON: false,
  MULTI_LANGUAGE: false,
  NEWSLETTER: true,
} as const;

/**
 * Environment helpers
 */
export const ENV = {
  /** Check if running in development */
  isDevelopment: () => process.env.NODE_ENV === 'development',
  /** Check if running in production */
  isProduction: () => process.env.NODE_ENV === 'production',
  /** Check if running in test */
  isTest: () => process.env.NODE_ENV === 'test',
  /** Check if running on client */
  isClient: () => typeof window !== 'undefined',
  /** Check if running on server */
  isServer: () => typeof window === 'undefined',
} as const;
