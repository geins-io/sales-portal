/**
 * Preloaded into the e2e preview with
 * `NODE_OPTIONS=--import=<absolute path to this file>` (Node >= 20.6).
 * Absolute because `nuxt preview` spawns the server with `.output` as cwd.
 *
 * Playwright's API client pools sockets with no idle limit and ignores the
 * server's `Keep-Alive: timeout=5` hint, while Node's server closes an idle
 * socket at about 6 s. A request written onto a socket in that moment is reset
 * (ECONNRESET, or "socket hang up"). Timeout 0 means the server never closes
 * an idle socket, so the race cannot happen. The e2e preview only: prod is not
 * talked to by Playwright and keeps Node's default. Preflight L1 checks it.
 */
import http from 'node:http';
import https from 'node:https';

for (const Server of [http.Server, https.Server]) {
  const listen = Server.prototype.listen;
  Server.prototype.listen = function (...args) {
    this.keepAliveTimeout = 0;
    console.log('[preview-keepalive] idle keep-alive close disabled');
    return listen.apply(this, args);
  };
}
