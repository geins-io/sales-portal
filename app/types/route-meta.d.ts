/**
 * Extends Nuxt's PageMeta interface to include custom route meta properties.
 *
 * This allows type-safe access to custom meta properties like `feature`
 * in middleware and route guards.
 */
declare module '#app' {
  interface PageMeta {
    /**
     * The required feature flag for accessing this route.
     * If specified, the feature middleware will check if this feature
     * is enabled for the current tenant before allowing access.
     *
     * @example
     * ```vue
     * <script setup>
     * definePageMeta({
     *   middleware: 'feature',
     *   feature: 'wishlist'
     * })
     * </script>
     * ```
     */
    feature?: string;

    /**
     * Required user roles (customerType values) for accessing this route.
     * Used by the auth middleware for role-based access control.
     *
     * @example
     * ```vue
     * <script setup>
     * definePageMeta({
     *   middleware: 'auth',
     *   roles: ['wholesale']
     * })
     * </script>
     * ```
     */
    roles?: string[];
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    /**
     * The required feature flag for accessing this route.
     */
    feature?: string;

    /**
     * Required user roles (customerType values) for accessing this route.
     */
    roles?: string[];
  }
}

export {};
