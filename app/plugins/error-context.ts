/**
 * Error Context Plugin
 *
 * Sets up Sentry context with tenant and user information.
 * Adds breadcrumbs for navigation to help debug errors.
 */
import { useErrorTracking } from '~/composables/useErrorTracking';
import { useAuthStore } from '~/stores/auth';

export default defineNuxtPlugin({
  name: 'error-context',
  setup() {
    // Only run on client - Sentry context is client-side
    if (!import.meta.client) return;

    const { tenant, tenantId } = useTenant();
    const authStore = useAuthStore();
    const router = useRouter();
    const { setTenant, setUser, addBreadcrumb } = useErrorTracking();

    // Set initial tenant context
    if (tenant.value) {
      setTenant({
        id: tenantId.value,
        name: tenant.value.branding?.name,
      });
    }

    // Watch for tenant changes
    watch(
      () => tenant.value,
      (newTenant) => {
        if (newTenant) {
          setTenant({
            id: newTenant.tenantId,
            name: newTenant.branding?.name,
          });
        } else {
          setTenant(null);
        }
      },
    );

    // Set initial user context
    if (authStore.user) {
      setUser({
        id: String(authStore.user.id),
        email: authStore.user.email,
      });
    }

    // Watch for auth changes
    watch(
      () => authStore.user,
      (newUser) => {
        if (newUser) {
          setUser({
            id: String(newUser.id),
            email: newUser.email,
          });
          addBreadcrumb('User logged in', 'auth', {
            userId: String(newUser.id),
          });
        } else {
          setUser(null);
          addBreadcrumb('User logged out', 'auth');
        }
      },
    );

    // Add breadcrumbs for route navigation
    router.afterEach((to, from) => {
      addBreadcrumb(`Navigated to ${to.path}`, 'navigation', {
        from: from.path,
        to: to.path,
      });
    });
  },
});
