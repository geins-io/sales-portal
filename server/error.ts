import type { NitroErrorHandler } from 'nitropack';
import { getRequestHeader, setResponseHeader, setResponseStatus } from 'h3';
import { logger } from './utils/logger';
import { readErrorHandlerConfig } from './utils/error-config';

/**
 * Custom Nitro error handler.
 *
 * Nitro's default handler scrubs 5xx messages to "Server Error" in
 * production and delegates rendering to Nuxt, which routes through
 * `app/error.vue`. That route depends on the Nuxt render pipeline
 * being fully booted — specifically on `@nuxtjs/i18n`'s per-request
 * context existing. When the error fires before i18n middleware has
 * had a chance to run (most commonly: tenant resolution throws in
 * `server/plugins/02.tenant-context.ts`), the render handler crashes
 * with "Nuxt I18n server context has not been set up yet.", Nitro
 * catches that second error, and falls back to its scrubbed default.
 * The user sees "Server Error" and nothing actionable.
 *
 * This handler sidesteps the whole pipeline: it renders a
 * self-contained HTML response directly for browser clients and a
 * structured JSON response for API clients. It never invokes Nuxt
 * rendering and has no composable dependencies. That is the point.
 *
 * Full rationale + options considered in `local-docs/ERROR-HANDLING-DESIGN.md`.
 */
const errorHandler: NitroErrorHandler = (error, event) => {
  const { debugErrors } = readErrorHandlerConfig(event);
  const statusCode = error.statusCode ?? 500;
  const statusMessage = error.statusMessage ?? 'Error';
  // Prefer the ID minted by the request-logging plugin (same ID the
  // JSON log entry will carry), but mint a fallback here too — if an
  // error fires so early that even the logging plugin hasn't run,
  // we still want something users can quote in a bug report.
  const correlationId = event.context.correlationId ?? mintFallbackId();
  const tenantId = event.context.tenant?.tenantId;
  const hostname = event.context.tenant?.hostname;
  const message = error.message || statusMessage;

  // "Tenant not provisioned" detection:
  //   1. No tenantId was ever attached to the event context — tenant
  //      resolution either never ran or failed early.
  //   2. The downstream error is `@nuxtjs/i18n`'s server-context
  //      crash, which only fires when Nuxt tried to render error.vue
  //      for an earlier thrown error before the i18n middleware
  //      initialised the per-request context.
  //
  // When both hold, the actual root cause is that the tenant isn't
  // in the merchant API yet — a config problem, not a code crash.
  // Swap the user-facing copy to something meaningful; keep the raw
  // message in the diagnostics block for support.
  const isTenantNotProvisioned =
    !tenantId &&
    typeof message === 'string' &&
    message.includes('Nuxt I18n server context has not been set up');

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

  setResponseStatus(event, statusCode, statusMessage);

  const accept = getRequestHeader(event, 'accept') ?? '';
  const wantsHtml = accept.includes('text/html');

  if (wantsHtml) {
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8');
    event.node.res.end(
      renderErrorHtml({
        statusCode,
        statusMessage,
        message,
        correlationId,
        tenantId,
        hostname,
        stack: debugErrors ? error.stack : undefined,
        isTenantNotProvisioned,
      }),
    );
    return;
  }

  setResponseHeader(event, 'content-type', 'application/json');

  const body: Record<string, unknown> = {
    error: true,
    statusCode,
    statusMessage,
    message,
    path: event.path,
  };
  if (correlationId) body.correlationId = correlationId;
  if (tenantId) body.tenantId = tenantId;
  if (hostname) body.hostname = hostname;
  if (error.data !== undefined) body.data = error.data;
  if (debugErrors && error.stack) body.stack = error.stack.split('\n');

  event.node.res.end(JSON.stringify(body));
};

export default errorHandler;

/**
 * Fallback correlation ID used only when no request-logging plugin ran.
 * Uses crypto.randomUUID when available, otherwise a timestamp-random
 * string — it only needs to be unique within a short window of time so
 * support can match it to a log entry.
 */
function mintFallbackId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// HTML template (exported for unit tests)
// ---------------------------------------------------------------------------

export interface ErrorHtmlInput {
  statusCode: number;
  statusMessage: string;
  message: string;
  correlationId: string | undefined;
  tenantId: string | undefined;
  hostname: string | undefined;
  stack?: string;
  /**
   * When true, overrides the 5xx "Something went wrong" copy with a
   * clean "store not yet configured" message. Used when the error
   * chain indicates the tenant isn't in the merchant API yet — a
   * provisioning step, not a runtime crash the user caused.
   */
  isTenantNotProvisioned?: boolean;
}

/**
 * Minimal HTML escape — DO NOT render any string into the template
 * without passing it through here. Covers the five characters that
 * can break out of a text node or attribute value.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderErrorHtml(input: ErrorHtmlInput): string {
  const {
    statusCode,
    statusMessage,
    message,
    correlationId,
    tenantId,
    hostname,
    stack,
    isTenantNotProvisioned,
  } = input;

  const is404 = statusCode === 404;
  const is500 = statusCode >= 500 && statusCode < 600;

  // Tenant-not-provisioned takes precedence over the generic 5xx copy —
  // same status code, cleaner message.
  const friendlyTitle = isTenantNotProvisioned
    ? 'Store not yet available'
    : is404
      ? 'Page not found'
      : is500
        ? 'Something went wrong'
        : statusMessage || 'Error';
  const friendlyDescription = isTenantNotProvisioned
    ? 'This store is being configured. Please check back soon.'
    : is404
      ? 'The page you are looking for does not exist or has been moved.'
      : is500
        ? 'We hit an unexpected error. The technical team has been notified.'
        : 'Please try again, or head back to the home page.';

  // Only show the raw error message when it's distinct from the
  // friendly copy — avoids "Something went wrong / Something went wrong".
  const showMessage = Boolean(
    message && message !== statusMessage && message !== friendlyDescription,
  );
  // Diagnostics panel appears for 500s (always useful for bug reports)
  // and for any error that carries a correlation ID. 404s without a
  // correlation ID stay clean — they're expected user errors.
  const showDiagnostics = is500 || Boolean(correlationId);
  const showTenantRow = Boolean(tenantId && is500);
  const showHostRow = Boolean(hostname && hostname !== tenantId && is500);

  const diagnosticsBlock = showDiagnostics
    ? `    <div class="diag">
${
  correlationId
    ? `      <p class="diag-row"><span class="diag-label">Reference ID:</span><code class="diag-value">${escapeHtml(correlationId)}</code></p>\n`
    : ''
}${
        showTenantRow
          ? `      <p class="diag-row"><span class="diag-label">Tenant:</span><code class="diag-value">${escapeHtml(tenantId!)}</code></p>\n`
          : ''
      }${
        showHostRow
          ? `      <p class="diag-row"><span class="diag-label">Host:</span><code class="diag-value">${escapeHtml(hostname!)}</code></p>\n`
          : ''
      }${
        showMessage
          ? `      <p class="diag-msg">${escapeHtml(message)}</p>\n`
          : ''
      }    </div>`
    : '';

  const stackBlock = stack
    ? `    <pre class="stack">${escapeHtml(stack)}</pre>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(String(statusCode))} — ${escapeHtml(friendlyTitle)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--background, #ffffff);
    color: var(--foreground, #1a1a1a);
  }
  @media (prefers-color-scheme: dark) {
    body { background: var(--background, #0a0a0a); color: var(--foreground, #f5f5f5); }
  }
  .wrap { max-width: 32rem; width: 100%; text-align: center; }
  .code { font-size: 4.5rem; font-weight: 700; color: var(--primary, #0d9488); margin: 0; line-height: 1; }
  .title { font-size: 1.5rem; font-weight: 600; margin: 1rem 0 0.5rem; }
  .desc { color: var(--muted-foreground, #6b7280); margin: 0; }
  .btns { margin-top: 2rem; display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
  .btn {
    display: inline-block;
    min-width: 140px;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .btn-primary { background: var(--primary, #0d9488); color: var(--primary-foreground, #ffffff); }
  .btn-outline { background: transparent; border-color: var(--border, #d4d4d8); color: inherit; }
  .diag {
    margin-top: 2rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 0.5rem;
    background: var(--muted, #f9fafb);
    text-align: left;
    font-size: 0.8125rem;
  }
  @media (prefers-color-scheme: dark) {
    .diag { background: var(--muted, #141414); border-color: var(--border, #262626); }
    .btn-outline { border-color: var(--border, #404040); }
  }
  .diag-row { margin: 0.125rem 0; }
  .diag-label { color: var(--muted-foreground, #6b7280); margin-right: 0.35rem; }
  .diag-value {
    font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    word-break: break-all;
    user-select: all;
  }
  .diag-msg {
    margin: 0.5rem 0 0;
    font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    word-break: break-word;
    color: var(--foreground, inherit);
  }
  pre.stack {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 0.5rem;
    background: var(--muted, #f3f4f6);
    text-align: left;
    font-size: 0.75rem;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
</head>
<body>
  <main class="wrap">
    <p class="code">${escapeHtml(String(statusCode))}</p>
    <h1 class="title">${escapeHtml(friendlyTitle)}</h1>
    <p class="desc">${escapeHtml(friendlyDescription)}</p>
    <div class="btns">
      <a class="btn btn-primary" href="/">Home</a>
      <a class="btn btn-outline" href="javascript:history.back()">Back</a>
    </div>
${diagnosticsBlock}
${stackBlock}
  </main>
</body>
</html>`;
}
