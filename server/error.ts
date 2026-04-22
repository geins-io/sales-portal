import type { NitroErrorHandler } from 'nitropack';
import { getRequestHeader, setResponseHeader, setResponseStatus } from 'h3';
import { logger } from './utils/logger';

/**
 * Custom Nitro error handler.
 *
 * Nitro's default handler scrubs 5xx messages to "Server Error" in
 * production, which leaves us blind on live incidents. This handler
 * surfaces:
 *
 *   - the real error message (no scrub in any env)
 *   - a correlation ID (from request logger) so App Insights lookups
 *     are one paste away
 *   - the resolved tenantId (when the request got past tenant context)
 *   - the stack trace — only when NUXT_DEBUG_ERRORS=true, to avoid
 *     leaking internals by default
 *
 * For non-JSON clients (browsers) the response is still the HTML
 * `app/error.vue` page; this handler only shapes the JSON payload
 * that API clients, curl, and monitoring see.
 */
const errorHandler: NitroErrorHandler = (error, event) => {
  const config = useRuntimeConfig(event);
  const statusCode = error.statusCode ?? 500;
  const correlationId = event.context.correlationId;
  const tenantId = event.context.tenant?.tenantId;
  const hostname = event.context.tenant?.hostname;

  if (statusCode >= 500) {
    logger.error(
      `[error-handler] ${event.method ?? 'GET'} ${event.path} → ${statusCode}`,
      error as Error,
      { correlationId, tenantId, hostname, path: event.path },
    );
  }

  if (correlationId) {
    setResponseHeader(event, 'x-correlation-id', correlationId);
  }
  if (tenantId) {
    setResponseHeader(event, 'x-tenant-id', tenantId);
  }

  const accept = getRequestHeader(event, 'accept') ?? '';
  const wantsHtml = accept.includes('text/html');

  // Let Nuxt's Vue error page render for browser requests — it reads
  // the error via `useError()` and already has a nice UI.
  if (wantsHtml) return;

  setResponseStatus(event, statusCode, error.statusMessage);
  setResponseHeader(event, 'content-type', 'application/json');

  const body: Record<string, unknown> = {
    error: true,
    statusCode,
    statusMessage: error.statusMessage ?? 'Error',
    message: error.message || error.statusMessage || 'Error',
    path: event.path,
  };

  if (correlationId) body.correlationId = correlationId;
  if (tenantId) body.tenantId = tenantId;
  if (hostname) body.hostname = hostname;
  if (error.data !== undefined) body.data = error.data;

  if (config.debugErrors && error.stack) {
    body.stack = error.stack.split('\n');
  }

  event.node.res.end(JSON.stringify(body));
};

export default errorHandler;
