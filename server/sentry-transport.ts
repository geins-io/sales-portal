/**
 * The HTTP module Sentry's node transport sends envelopes through
 * (`transportOptions.httpModule` in `sentry.server.config.ts`).
 *
 * The transport settles a request only on a response or an `'error'`, and its
 * agent's `timeout` aborts nothing, so a silent ingest connection would stay
 * pending until restart and hold one of the transport's 64 buffer slots.
 * Destroying it makes the transport reject and free the slot.
 */
import http from 'node:http';
import https from 'node:https';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';

/** Socket inactivity, not a deadline: a slow but moving upload is left alone. */
export const SENTRY_TRANSPORT_IDLE_TIMEOUT_MS = 10_000;

export interface SentryHttpModule {
  request(
    options: RequestOptions,
    callback?: (res: IncomingMessage) => void,
  ): ClientRequest;
}

export function createIdleTimeoutHttpModule(
  timeoutMs: number,
): SentryHttpModule {
  return {
    request(options, callback) {
      // The transport's agent is built for the URL's protocol, so the module
      // has to match it per request.
      const transport = options.protocol === 'https:' ? https : http;
      const req = transport.request(options, callback);
      req.setTimeout(timeoutMs, () => {
        req.destroy(
          new Error(`Sentry transport request idle for ${timeoutMs} ms`),
        );
      });
      return req;
    },
  };
}
