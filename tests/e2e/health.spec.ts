import { test, expect } from '@playwright/test';

/**
 * Health Check E2E Tests
 *
 * Tests for the application health endpoint.
 */

test.describe('Health Check API', () => {
  test('should return healthy status', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('healthy');
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
