/**
 * Nuxt-specific Test Setup
 *
 * Extends base setup with mock endpoint registration.
 * Only loaded by the nuxt project in vitest.workspace.ts.
 */

import './setup';
import { registerEndpoint } from '@nuxt/test-utils/runtime';
import type { PublicTenantConfig } from '#shared/types/tenant-config';

const mockTenantConfig: PublicTenantConfig = {
  tenantId: 'test-tenant',
  hostname: 'test.example.com',
  isActive: true,
  css: '',
  mode: 'commerce',
  branding: {
    name: 'Test Store',
    watermark: 'full',
    logoUrl: '/logo.svg',
    faviconUrl: '/favicon.ico',
  },
  theme: {
    name: 'default',
    displayName: 'Default Theme',
    colors: {
      primary: 'oklch(0.205 0 0)',
      secondary: 'oklch(0.97 0 0)',
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.145 0 0)',
      primaryForeground: 'oklch(0.985 0 0)',
      secondaryForeground: 'oklch(0.205 0 0)',
    },
    radius: '0.625rem',
  },
  features: {
    search: { enabled: true },
    authentication: { enabled: true },
    cart: { enabled: true },
  },
  locale: 'sv-SE',
  availableLocales: ['sv-SE'],
};

registerEndpoint('/api/config', () => mockTenantConfig);
