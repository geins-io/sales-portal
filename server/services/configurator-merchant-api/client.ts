import { logger } from '../../utils/logger';
import type { MerchantApiTarget } from '../configurator';

// ---------------------------------------------------------------------------
// One GraphQL request to merchant-api, with the headers the SDK sends.
//
// The SDK cannot be used: its endpoint is a constant, and the CPQ area lives on
// another host until it ships in the ordinary one. Nothing the transport throws
// is passed on or logged, because a fetch error carries the request URL; every
// failure is rethrown with a fixed text, the status and the GraphQL codes.
// ---------------------------------------------------------------------------

/** Measured 1–3 s per canary round trip; a hung request fails well after. */
const TIMEOUT_MS = 15_000;

/**
 * The read of a cart's lines or an order's rows; a cart's measured at 60–300 ms
 * warm and about 400 ms cold. Past this the cart or the order answers without
 * their configurations, and a configured add, which reads the lines first,
 * fails rather than risk a second line.
 */
export const LINE_READ_TIMEOUT_MS = 2_000;

/**
 * A reopen replays the session's change log, measured at 2 s for one change
 * and 17 s for forty. The provider gives up itself at about 35 s with a 503, so
 * this waits past that and the provider's answer always arrives first.
 */
export const REOPEN_TIMEOUT_MS = 45_000;

interface GraphQLBody<T> {
  data?: T | null;
  errors?:
    | { message?: unknown; extensions?: { code?: unknown } | null }[]
    | null;
}

/** The provider's codes the portal answers with its own status. */
function knownFailure(code: string) {
  switch (code) {
    case 'ConfigurationNotFound':
      return createAppError(ErrorCode.NOT_FOUND, 'No such configuration');
    case 'ConfigurationGone':
      return createAppError(ErrorCode.GONE, 'The configuration is finished');
    case 'MissingCustomerNumber':
      return createAppError(
        ErrorCode.FORBIDDEN,
        "The buyer's company has no customer number",
      );
    case 'ConfigurationFailed':
      return createAppError(
        ErrorCode.VALIDATION_ERROR,
        'The provider rejected the change',
      );
    case 'ConfigurationMismatch':
      return createAppError(
        ErrorCode.VALIDATION_ERROR,
        'The committed configuration is not for this article',
      );
    // Two codes, because a signed-in buyer of another company must not be
    // told to sign in.
    case 'LoginRequired':
      return createAppError(
        ErrorCode.UNAUTHORIZED,
        'The cart needs a signed-in buyer',
      );
    case 'ConfigurationNotReopenable':
      return createAppError(
        ErrorCode.VALIDATION_ERROR,
        'The configuration cannot be reopened',
      );
    case 'CartItemNotConfigured':
      return createAppError(
        ErrorCode.CART_LINE_GONE,
        'The cart line carries no configuration',
      );
    case 'CartBelongsToAnotherCompany':
      return createAppError(
        ErrorCode.CART_NOT_OWN,
        "The cart is another company's",
      );
    default:
      return undefined;
  }
}

function failed(reason: string) {
  return createAppError(
    ErrorCode.EXTERNAL_API_ERROR,
    `The configurator backend ${reason}`,
  );
}

export async function requestMerchantApi<T>(
  target: MerchantApiTarget,
  userToken: string | undefined,
  query: string,
  variables: Record<string, unknown>,
  { timeoutMs = TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(target.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-apikey': target.apiKey,
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw failed('could not be reached');
  }

  let body: GraphQLBody<T>;
  try {
    body = await response.json();
  } catch {
    throw failed(`answered ${response.status} without JSON`);
  }

  // GraphQL requires a message on every error.
  const failures = (body.errors ?? []).map((error) => ({
    code: String(error.extensions?.code ?? 'none'),
    reason: String(error.message),
  }));
  for (const { code, reason } of failures) {
    const known = knownFailure(code);
    if (!known) continue;
    // The reason names the change the provider refused ("Variable … is
    // read-only"). The buyer gets the page's form error; the reason is logged.
    if (code === 'ConfigurationFailed') {
      logger.warn(`[configurator] ${code}: ${reason}`);
    }
    throw known;
  }
  const codes = failures.map(({ code }) => code);
  if (codes.length > 0 || !response.ok) {
    throw failed(`answered ${response.status}, codes [${codes.join(', ')}]`);
  }
  if (!body.data) throw failed('answered without data');

  return body.data;
}
