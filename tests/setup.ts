/**
 * Global Test Setup
 *
 * This file is executed before all tests to set up the test environment.
 */

import { registerEndpoint } from '@nuxt/test-utils/runtime';
import type { TenantConfig } from '#shared/types/tenant-config';

// Mock tenant configuration for tests
const mockTenantConfig: TenantConfig = {
  tenantId: 'test-tenant',
  hostname: 'test.example.com',
  isActive: true,
  css: '',
  branding: {
    name: 'Test Store',
    logoUrl: '/logo.svg',
    faviconUrl: '/favicon.ico',
  },
  theme: {
    name: 'default',
    displayName: 'Default Theme',
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
    },
  },
  features: {
    search: true,
    authentication: true,
    cart: true,
  },
};

// Register mock endpoint for /api/config
registerEndpoint('/api/config', () => mockTenantConfig);
