/**
 * Server-side Storage Key Constants
 *
 * Centralized constants for KV storage keys used throughout the application.
 * These are primarily used for tenant data storage in the server-side KV store.
 */

/**
 * Storage key prefixes for tenant data in KV storage
 */
export const KV_STORAGE_KEYS = {
  /** Prefix for tenant ID mappings (hostname -> tenant ID) */
  TENANT_ID_PREFIX: 'tenant:id:',
  /** Prefix for tenant configuration storage */
  TENANT_CONFIG_PREFIX: 'tenant:config:',
  /** Prefix for webhook delivery deduplication */
  WEBHOOK_PROCESSED_PREFIX: 'webhook:processed:',
} as const;

/**
 * Type for the KV storage keys object
 */
export type KvStorageKeys = typeof KV_STORAGE_KEYS;

/**
 * Cookie name constants used by both server and client
 */
/**
 * LocalStorage key prefixes used by client-side composables
 */
export const LOCAL_STORAGE_KEYS = {
  /** Prefix for per-tenant analytics consent flag */
  ANALYTICS_CONSENT_PREFIX: 'analytics-consent-',
} as const;

/**
 * Cookie name constants used by both server and client
 */
export const COOKIE_NAMES = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  TENANT_ID: 'tenant_id',
  LOCALE: 'i18n_redirected',
  MARKET: 'market',
  CART_ID: 'cart_id',
} as const;
