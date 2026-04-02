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
