import type { ErrorResponseInput } from '../error';
import type { TenantResolutionOutcome } from './tenant';

/**
 * How a request for a hostname with no tenant config is answered. Shared by
 * the page refusal and `/api/config`, so both answer the same status.
 */
export function tenantRefusal(
  outcome: TenantResolutionOutcome | undefined,
): ErrorResponseInput {
  if (outcome === 'transport-failure') {
    return {
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message:
        'This site is temporarily unavailable. Please try again in a moment.',
    };
  }
  return {
    statusCode: 404,
    statusMessage: 'Not Found',
    message:
      'This site is not available. If you believe this is an error, please contact support.',
    isTenantNotProvisioned: true,
  };
}
