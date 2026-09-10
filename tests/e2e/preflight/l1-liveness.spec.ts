import { test, expect } from '@playwright/test';

/**
 * Preflight L1. The process serves requests: /api/health answers below 500
 * with a well-formed body. The dev server reports its memory without grading
 * it (`server/utils/health-memory.ts`), so a 503 here is a fault in every
 * mode rather than Vite's resident set.
 */

test('L1 liveness: /api/health answers', async ({ request }) => {
  const response = await request.get('/api/health');
  const status = response.status();
  const body = (await response.json().catch(() => null)) as {
    status?: string;
    timestamp?: string;
  } | null;

  expect(
    status,
    `/api/health answered ${status}${body?.status ? ` (${body.status})` : ''}`,
  ).toBeLessThan(500);
  expect(body?.status, '/api/health body has no status').toMatch(
    /^(healthy|degraded|unhealthy)$/,
  );
  expect(
    new Date(body?.timestamp ?? '').getTime(),
    '/api/health timestamp is not a date',
  ).toBeGreaterThan(0);
});
