/**
 * Common Types
 *
 * Shared type definitions used throughout the application.
 */

/**
 * Environment type
 */
export type Environment = 'development' | 'production' | 'staging';

/**
 * Generic ID type
 */
export type ID = string | number;

/**
 * Nullable type helper
 */
export type Nullable<T> = T | null;

/**
 * Optional type helper
 */
export type Optional<T> = T | undefined;

/**
 * Deep partial type helper
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make specific keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/**
 * Extract keys of type from object
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Base entity with timestamps
 */
export interface BaseEntity {
  /** Unique identifier */
  id: ID;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Soft-deletable entity
 */
export interface SoftDeletable {
  /** Deletion timestamp (ISO 8601), null if not deleted */
  deletedAt: string | null;
}

/**
 * Entity with audit fields
 */
export interface Auditable extends BaseEntity {
  /** User ID who created the entity */
  createdBy?: string;
  /** User ID who last updated the entity */
  updatedBy?: string;
}

/**
 * Key-value pair
 */
export interface KeyValue<K = string, V = unknown> {
  key: K;
  value: V;
}

/**
 * Name-value pair (for display)
 */
export interface NameValue<V = string> {
  name: string;
  value: V;
}

/**
 * Select option type for dropdowns
 */
export interface SelectOption<V = string> {
  /** Display label */
  label: string;
  /** Option value */
  value: V;
  /** Whether the option is disabled */
  disabled?: boolean;
  /** Optional icon name */
  icon?: string;
  /** Optional description */
  description?: string;
}

/**
 * Tree node structure
 */
export interface TreeNode<T = unknown> {
  /** Node ID */
  id: ID;
  /** Node label */
  label: string;
  /** Child nodes */
  children?: TreeNode<T>[];
  /** Additional node data */
  data?: T;
  /** Whether the node is expanded */
  expanded?: boolean;
  /** Whether the node is selectable */
  selectable?: boolean;
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Navigation path */
  href?: string;
  /** Lucide icon name */
  icon?: string;
  /** Whether this is the current page */
  current?: boolean;
}

/**
 * Status type for various entities
 */
export type Status = 'active' | 'inactive' | 'pending' | 'archived';

/**
 * Status with badge variant mapping
 */
export interface StatusBadge {
  status: Status;
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

/**
 * Date range
 */
export interface DateRange {
  /** Start date (ISO 8601) */
  start: string;
  /** End date (ISO 8601) */
  end: string;
}

/**
 * Price/money value
 */
export interface Money {
  /** Amount in smallest currency unit (e.g., cents) */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Formatted display value */
  formatted?: string;
}

/**
 * Address structure
 */
export interface Address {
  /** Street address line 1 */
  street1: string;
  /** Street address line 2 */
  street2?: string;
  /** City */
  city: string;
  /** State/Province/Region */
  state?: string;
  /** Postal/ZIP code */
  postalCode: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
}

/**
 * Contact information
 */
export interface Contact {
  /** Full name */
  name?: string;
  /** Email address */
  email?: string;
  /** Phone number */
  phone?: string;
  /** Fax number */
  fax?: string;
  /** Website URL */
  website?: string;
}

/**
 * File/attachment metadata
 */
export interface FileMetadata {
  /** File name */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** File URL */
  url: string;
  /** Thumbnail URL (for images) */
  thumbnailUrl?: string;
  /** Upload timestamp */
  uploadedAt?: string;
}

/**
 * Image with multiple sizes
 */
export interface ResponsiveImage {
  /** Original image URL */
  original: string;
  /** Large size URL */
  large?: string;
  /** Medium size URL */
  medium?: string;
  /** Small size URL */
  small?: string;
  /** Thumbnail URL */
  thumbnail?: string;
  /** Alt text */
  alt?: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
}

/**
 * User information
 */
export interface User {
  /** Unique user identifier */
  id: ID;
  /** User email address */
  email: string;
  /** User display name */
  name?: string;
  /** User first name */
  firstName?: string;
  /** User last name */
  lastName?: string;
  /** User avatar URL */
  avatar?: string;
  /** User roles */
  roles?: string[];
  /** User metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Authentication credentials for login
 */
export interface LoginCredentials {
  /** User email address */
  email: string;
  /** User password */
  password: string;
  /** Remember the user session */
  rememberMe?: boolean;
}

/**
 * Authentication response from API
 */
export interface AuthResponse {
  /** User information */
  user: User;
  /** Authentication token (JWT or similar) */
  token: string;
  /** Token expiration timestamp (ISO 8601) */
  expiresAt?: string;
  /** Refresh token for token renewal */
  refreshToken?: string;
}

/**
 * Route resolution types for dynamic routing
 */
export type RouteResolutionType = 'product' | 'category' | 'page' | 'not-found';

/**
 * Base route resolution interface
 */
interface BaseRouteResolution {
  /** The type of route resolved */
  type: RouteResolutionType;
  /** Canonical URL for SEO */
  canonical?: string;
}

/**
 * Product route resolution
 */
export interface ProductRouteResolution extends BaseRouteResolution {
  type: 'product';
  /** Product identifier */
  productId: ID;
  /** Product slug from URL */
  productSlug?: string;
  /** Category slug from URL (parent category) */
  categorySlug?: string;
}

/**
 * Category route resolution
 */
export interface CategoryRouteResolution extends BaseRouteResolution {
  type: 'category';
  /** Category identifier */
  categoryId: ID;
  /** Category slug from URL */
  categorySlug?: string;
}

/**
 * Content page route resolution
 */
export interface PageRouteResolution extends BaseRouteResolution {
  type: 'page';
  /** Page identifier */
  pageId: ID;
  /** Page slug from URL */
  pageSlug?: string;
}

/**
 * Not found route resolution
 */
export interface NotFoundRouteResolution extends BaseRouteResolution {
  type: 'not-found';
}

/**
 * Union type for all route resolutions
 */
export type RouteResolution =
  | ProductRouteResolution
  | CategoryRouteResolution
  | PageRouteResolution
  | NotFoundRouteResolution;
