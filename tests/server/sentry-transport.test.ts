/**
 * The HTTP module Sentry's node transport sends envelopes through.
 *
 * The transport settles a request only on a response or an `'error'`, and its
 * agent's `timeout` emits `'timeout'` without aborting anything, so an ingest
 * connection that goes silent would stay pending for the life of the process.
 * These tests run against real sockets: a server that accepts and never
 * answers is the failure being guarded against.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import {
  SENTRY_TRANSPORT_IDLE_TIMEOUT_MS,
  createIdleTimeoutHttpModule,
} from '../../server/sentry-transport';

const servers: net.Server[] = [];

async function listen(server: net.Server): Promise<number> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

/** Accepts the connection and reads the body, never answers. */
function silentServer(): Promise<number> {
  return listen(net.createServer((socket) => socket.resume()));
}

function answeringServer(): Promise<number> {
  return listen(
    http.createServer((req, res) => {
      req.resume();
      req.on('end', () => res.end('{}'));
    }),
  );
}

function post(
  port: number,
  timeoutMs: number,
): { req: http.ClientRequest; settled: Promise<string> } {
  let req!: http.ClientRequest;
  const settled = new Promise<string>((resolve) => {
    req = createIdleTimeoutHttpModule(timeoutMs).request(
      {
        method: 'POST',
        hostname: '127.0.0.1',
        port,
        path: '/api/1/envelope/',
        protocol: 'http:',
        // As the transport's own agent: one socket per request.
        agent: new http.Agent({ keepAlive: false }),
      },
      (res) => {
        res.on('data', () => {});
        resolve(`response ${res.statusCode}`);
      },
    );
    req.on('error', (error) => resolve(`error ${error.message}`));
    req.end('{}');
  });
  return { req, settled };
}

describe.sequential('createIdleTimeoutHttpModule', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise((resolve) => server.close(resolve))),
    );
  });

  it('idles out at ten seconds by default', () => {
    expect(SENTRY_TRANSPORT_IDLE_TIMEOUT_MS).toBe(10_000);
  });

  it('destroys a request whose connection goes silent', async () => {
    const port = await silentServer();

    const { req, settled } = post(port, 50);

    expect(await settled).toBe('error Sentry transport request idle for 50 ms');
    expect(req.destroyed).toBe(true);
  });

  it('leaves a request that is answered alone', async () => {
    const port = await answeringServer();

    const { req, settled } = post(port, 500);
    const errors: Error[] = [];
    req.on('error', (error) => errors.push(error));

    expect(await settled).toBe('response 200');
    // Past the idle timeout: an answered request is never destroyed late.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(errors).toEqual([]);
  });

  it('sends https: requests through node:https with the options unchanged', () => {
    const setTimeout = vi.fn();
    const request = vi
      .spyOn(https, 'request')
      .mockReturnValue({ setTimeout } as unknown as http.ClientRequest);
    const httpRequest = vi.spyOn(http, 'request');
    const options = { protocol: 'https:', hostname: 'ingest.example' };
    const callback = vi.fn();

    const req = createIdleTimeoutHttpModule(1234).request(options, callback);

    expect(request).toHaveBeenCalledWith(options, callback);
    expect(httpRequest).not.toHaveBeenCalled();
    expect(req.setTimeout).toHaveBeenCalledWith(1234, expect.any(Function));
  });

  it('sends every other protocol through node:http', () => {
    const setTimeout = vi.fn();
    const request = vi
      .spyOn(http, 'request')
      .mockReturnValue({ setTimeout } as unknown as http.ClientRequest);
    const httpsRequest = vi.spyOn(https, 'request');
    const options = { protocol: 'http:', hostname: 'ingest.example' };

    createIdleTimeoutHttpModule(1234).request(options);

    expect(request).toHaveBeenCalledWith(options, undefined);
    expect(httpsRequest).not.toHaveBeenCalled();
  });
});
