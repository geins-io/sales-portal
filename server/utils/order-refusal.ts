import { ErrorCode } from './errors';

/**
 * The Geins codes a refused order is answered with by name. Geins sends most
 * refusals (missing fields, payment) without any code, so those and every
 * code not listed here are the generic ORDER_FAILED.
 */
const REFUSALS = new Map<string, ErrorCode>([
  ['INVALID_IDENTITY_NUMBER', ErrorCode.ORDER_INVALID_IDENTITY_NUMBER],
]);

export function orderRefusalCode(code: string | undefined): ErrorCode {
  return (code && REFUSALS.get(code)) || ErrorCode.ORDER_FAILED;
}
