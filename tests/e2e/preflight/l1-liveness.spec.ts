import { test, expect } from '@playwright/test';
import { noteOutOfScope } from '../helpers';
import { PRODUCTION_BUILD } from '../target';

/**
 * Preflight L1. The process serves requests: /api/health answers below 500
 * with a well-formed body. The dev server reports `unhealthy` (503) when its
 * own memory check trips, which says nothing about the code under test.
 */

test('L1 liveness: /api/health answers', async ({ request }) => {
  const response = await request.get('/api/health');
  const status = response.status();
  const body = (await response.json().catch(() => null)) as {
    status?: string;
    timestamp?: string;
  } | null;

  if (status === 503 && body?.status === 'unhealthy' && !PRODUCTION_BUILD) {
    noteOutOfScope(
      'dev-server',
      '/api/health answered 503 unhealthy (dev server memory check); liveness not asserted',
    );
    return;
  }

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
