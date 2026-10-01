import { test, expect } from '@playwright/test';
import { outOfScope } from '../helpers';
import { PRODUCTION_BUILD, REMOTE_TARGET } from '../target';

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

/**
 * The preview runs with `tests/e2e/preview-keepalive.mjs`, without which
 * Playwright's pooled API requests are reset at random (see that file).
 */
test('L1 liveness: the preview keeps idle connections open', async ({
  request,
}) => {
  outOfScope(
    REMOTE_TARGET,
    'remote-target',
    'E2E_REMOTE=1: a deployed server keeps its own keep-alive timeout',
  );
  outOfScope(
    !PRODUCTION_BUILD,
    'dev-server',
    'the preload is wired into the production-build preview only',
  );

  const headers = (await request.get('/api/health')).headers();

  expect(headers.connection, 'the preview does not answer keep-alive').toBe(
    'keep-alive',
  );
  expect(
    headers['keep-alive'],
    `the preview closes idle sockets (Keep-Alive: ${headers['keep-alive']}). ` +
      'A preview you start yourself (E2E_PROD=1 E2E_EXTERNAL_SERVER=1) needs ' +
      'NODE_OPTIONS=--import=$PWD/tests/e2e/preview-keepalive.mjs, as ci.yml starts it',
  ).toBeUndefined();
});
