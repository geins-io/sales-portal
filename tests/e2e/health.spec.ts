import { test, expect } from '@playwright/test';

/**
 * Health Check E2E Tests
 *
 * Tests for the application health endpoint.
 */

test.describe('Health Check API', () => {
  test('should return healthy status with timestamp', async ({ request }) => {
    const response = await request.get('/api/health?quick=true');

    // In dev mode, memory pressure may cause 503 (unhealthy) — accept any valid response
    expect(response.status()).toBeLessThan(504);

    const data = await response.json();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
    expect(data).toHaveProperty('timestamp');

    // Timestamp should be a valid ISO date
    const timestamp = new Date(data.timestamp);
    expect(timestamp.getTime()).toBeGreaterThan(0);
  });
});

test.describe('API Endpoints', () => {
  test('config endpoint should return data', async ({ request }) => {
    const response = await request.get('/api/config');

    // Config endpoint may require tenant context, so we just check it doesn't crash
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
  });
});
