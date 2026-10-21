import { describe, it, expect } from 'vitest';
import { tenantRefusal } from '../../server/utils/tenant-refusal';

describe('tenantRefusal', () => {
  it('answers 503 when the merchant API could not be reached', () => {
    const refusal = tenantRefusal('transport-failure');
    expect(refusal).toEqual({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message:
        'This site is temporarily unavailable. Please try again in a moment.',
    });
  });

  it.each(['unknown-tenant', 'invalid-config', 'negative-cache', undefined])(
    'answers 404 for outcome %s',
    (outcome) => {
      expect(
        tenantRefusal(
          outcome as Parameters<typeof tenantRefusal>[0] | undefined,
        ),
      ).toEqual({
        statusCode: 404,
        statusMessage: 'Not Found',
        message:
          'This site is not available. If you believe this is an error, please contact support.',
        isTenantNotProvisioned: true,
      });
    },
  );
});
