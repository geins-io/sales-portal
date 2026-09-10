import { test, expect } from '@playwright/test';
import { BASE_URL, EXPECTED_TENANT_ID } from '../target';

/**
 * Preflight L2. The origin resolves the hostname to the tenant the run is
 * configured for. Three distinct failures: the merchant API could not be
 * reached (503), the hostname is not registered (204/404), another tenant
 * answered (200 with a different id).
 */

function describeStatus(status: number): string {
  const host = new URL(BASE_URL).hostname;
  if (status === 503) {
    return `/api/config answered 503: the merchant API could not be reached from the server`;
  }
  if (status === 204 || status === 404) {
    return `/api/config answered ${status}: "${host}" is not a registered hostname`;
  }
  return `/api/config answered ${status}`;
}

test('L2 identity: /api/config names the expected tenant', async ({
  request,
}) => {
  const response = await request.get('/api/config');
  const status = response.status();

  expect(status, describeStatus(status)).toBe(200);

  const body = (await response.json()) as { tenantId?: string };
  expect(
    body.tenantId,
    `expected tenant "${EXPECTED_TENANT_ID}" (E2E_EXPECTED_TENANT_ID), the server resolved "${body.tenantId}"`,
  ).toBe(EXPECTED_TENANT_ID);
});
