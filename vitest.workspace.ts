import { defineProject } from 'vitest/config';
import {
  defineVitestProject,
  getVitestConfigFromNuxt,
} from '@nuxt/test-utils/config';

// Files that need the full Nuxt test environment (registerEndpoint / mockNuxtImport / useNuxtApp)
const nuxtTestFiles = [
  'tests/composables/useCmsPreview.test.ts',
  'tests/composables/useTenant.test.ts',
  'tests/composables/useErrorTracking.test.ts',
  'tests/components/layout/LayoutHeaderMain.test.ts',
  'tests/components/layout/MobileNavPanel.test.ts',
  'tests/server/api-contracts.test.ts',
  'tests/server/external-api.test.ts',
];

// Component tests — need DOM (happy-dom) but not full Nuxt runtime.
// useTenant is mocked via setup-components.ts instead of registerEndpoint.
const componentTestFiles = [
  'tests/components/Button.test.ts',
  'tests/components/Copyright.test.ts',
  'tests/components/ErrorBoundary.test.ts',
  'tests/components/Logo.test.ts',
  'tests/components/PoweredBy.test.ts',
  'tests/components/SearchBar.test.ts',
  'tests/components/layout/LayoutFooter.test.ts',
  'tests/components/layout/LayoutHeaderActionButtons.test.ts',
  'tests/components/layout/LayoutHeaderNav.test.ts',
  'tests/components/layout/LayoutHeaderTopbar.test.ts',
  'tests/components/GeinsImage.test.ts',
  'tests/components/cms/CmsWidgetArea.test.ts',
  'tests/components/cms/CmsContainer.test.ts',
  'tests/components/cms/CmsWidget.test.ts',
  'tests/components/cms/TextWidget.test.ts',
  'tests/components/cms/ImageWidget.test.ts',
  'tests/components/cms/BannerWidget.test.ts',
  'tests/components/cms/ButtonsWidget.test.ts',
  'tests/components/commerce/PriceDisplay.test.ts',
  'tests/components/commerce/StockBadge.test.ts',
  'tests/components/commerce/ProductCard.test.ts',
  'tests/components/commerce/QuantityInput.test.ts',
  'tests/components/commerce/LoadingState.test.ts',
  'tests/components/commerce/EmptyState.test.ts',
  'tests/components/AppBreadcrumbs.test.ts',
  'tests/components/product/ProductFilters.test.ts',
  'tests/components/product/ProductListToolbar.test.ts',
  'tests/components/product/ProductGallery.test.ts',
  'tests/components/product/VariantSelector.test.ts',
  'tests/components/product/ProductTabs.test.ts',
  'tests/components/product/ReviewCard.test.ts',
  'tests/components/product/RelatedProducts.test.ts',
  'tests/components/search/SearchAutocomplete.test.ts',
  'tests/components/cart/CartItem.test.ts',
  'tests/components/cart/CartDrawer.test.ts',
  'tests/components/cart/CartPage.test.ts',
  'tests/components/shared/Pagination.test.ts',
  'tests/components/pages/PageSidebarNav.test.ts',
  'tests/components/pages/Content.test.ts',
  'tests/components/pages/ProductListSkeleton.test.ts',
  'tests/components/pages/ProductDetailsSkeleton.test.ts',
  'tests/components/pages/ContentPageSkeleton.test.ts',
  'tests/components/pages/SearchResultsSkeleton.test.ts',
  'tests/components/pages/CartPageSkeleton.test.ts',
  'tests/components/auth/AuthCard.test.ts',
  'tests/components/auth/LoginForm.test.ts',
  'tests/components/auth/RegisterForm.test.ts',
  'tests/components/auth/LoginPage.test.ts',
];

// Get Nuxt's Vite config once (aliases, auto-imports, plugins)
const nuxtViteConfig = getVitestConfigFromNuxt(undefined, {
  overrides: { experimental: { appManifest: false } },
});

export default [
  // Tier 1: Node — fast tests with Nuxt's Vite config but no Nuxt runtime
  nuxtViteConfig.then((config) =>
    defineProject({
      ...config,
      test: {
        ...config.test,
        name: 'node',
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        exclude: [
          ...nuxtTestFiles,
          ...componentTestFiles,
          '**/node_modules/**',
          '**/.nuxt/**',
          '**/dist/**',
          'tests/e2e/**',
        ],
        setupFiles: ['./tests/setup.ts'],
        globals: true,
        isolate: false,
        sequence: { concurrent: true },
      },
    }),
  ),
  // Tier 2: Components — jsdom DOM with mocked useTenant (no Nuxt boot)
  nuxtViteConfig.then((config) =>
    defineProject({
      ...config,
      test: {
        ...config.test,
        name: 'components',
        environment: 'happy-dom',
        include: componentTestFiles,
        setupFiles: ['./tests/setup-components.ts'],
        globals: true,
        isolate: false,
        sequence: { concurrent: true },
      },
    }),
  ),
  // Tier 3: Nuxt — tests that truly need the full Nuxt environment
  defineVitestProject({
    test: {
      name: 'nuxt',
      include: nuxtTestFiles,
      setupFiles: ['./tests/setup-nuxt.ts'],
      globals: true,
      sequence: { concurrent: true },
      environmentOptions: {
        nuxt: {
          overrides: {
            experimental: { appManifest: false },
          },
        },
      },
    },
  }),
];
