/**
 * Global Test Setup
 *
 * This file is executed before all tests to set up the test environment.
 */

import { vi } from 'vitest';
import { registerEndpoint } from '@nuxt/test-utils/runtime';
import type { PublicTenantConfig } from '#shared/types/tenant-config';

// Suppress console output globally for clean test runs.
// Tests that need to assert on console calls can use mockConsole() from tests/utils.
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

// Mock tenant configuration for tests (public shape — what the client receives)
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

// Register mock endpoint for /api/config
registerEndpoint('/api/config', () => mockTenantConfig);
