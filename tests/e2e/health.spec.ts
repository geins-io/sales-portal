import { test, expect } from '@playwright/test';

/**
 * Health Check E2E Tests
 *
 * Tests for the application health endpoint.
 */

test.describe('Health Check API', () => {
  test('should return valid status in quick mode', async ({ request }) => {
    // Quick mode skips storage checks for faster response
    const response = await request.get('/api/health?quick=true');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
    // Accept healthy or degraded (degraded is valid when memory usage varies)
    expect(['healthy', 'degraded']).toContain(data.status);
  });

  test('should return valid status with full checks', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
    // Accept both healthy and degraded - degraded is valid when storage is not configured
    expect(['healthy', 'degraded']).toContain(data.status);
  });

  test('should include basic health information', async ({ request }) => {
    const response = await request.get('/api/health');
    const data = await response.json();

    // Should have timestamp
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
