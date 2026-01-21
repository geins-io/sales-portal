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
} as const;

/**
 * Type for the KV storage keys object
 */
export type KvStorageKeys = typeof KV_STORAGE_KEYS;
