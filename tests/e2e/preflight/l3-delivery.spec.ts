import { test, expect } from '@playwright/test';
import { waitForHydration } from '../helpers';

/**
 * Preflight L3. The client bundle loads and Vue mounts. Every spec that
 * only reads server-rendered HTML passes against a build whose JavaScript
 * never runs; this is the check that does not.
 */

test('L3 delivery: the client bundle loads and hydrates', async ({ page }) => {
  const scriptFailures: string[] = [];
  page.on('requestfailed', (request) => {
    if (request.url().includes('/_nuxt/')) {
      scriptFailures.push(
        `${request.url()} ${request.failure()?.errorText ?? ''}`,
      );
    }
  });

  await page.goto('/');
  await page.waitForLoadState('load');

  expect(
    scriptFailures,
    'client bundle requests must load (a CSP upgrade over plain http breaks them all)',
  ).toEqual([]);

  // Resolves only once `__vue_app__` is on #__nuxt; a timeout is the
  // assertion — Vue never mounted.
  await waitForHydration(page).catch((error: Error) => {
    throw new Error(
      `Vue never mounted on #__nuxt: the client JavaScript did not run (${error.message.split('\n')[0]})`,
    );
  });
});
