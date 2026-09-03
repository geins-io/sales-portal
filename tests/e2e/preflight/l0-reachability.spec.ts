import { test, expect, type APIResponse } from '@playwright/test';
import { BASE_URL } from '../target';

/**
 * Preflight L0. Any HTTP answer counts; what it says is for the layers
 * above. Polls for a short window so a server started just before the run
 * (CI starts the preview in its own step) does not fail on the first probe.
 */

const WINDOW_MS = 20_000;

test('L0 reachability: the origin answers', async ({ request }) => {
  const deadline = Date.now() + WINDOW_MS;
  let response: APIResponse | undefined;
  let lastError = '';

  while (!response && Date.now() < deadline) {
    try {
      response = await request.get('/', { maxRedirects: 0, timeout: 5_000 });
    } catch (error) {
      lastError = (error as Error).message.split('\n')[0] ?? String(error);
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }

  expect(
    response,
    `${BASE_URL} did not answer within ${WINDOW_MS / 1000}s: ${lastError}`,
  ).toBeDefined();
});
