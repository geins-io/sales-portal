/**
 * The failure text for a target that did not answer. Kept apart from the spec
 * because the interesting part is a decision, not a probe: the same timeout
 * means three different things depending on whether the name is this machine
 * and whether anything holds the port.
 */

export interface UnreachableContext {
  /** The origin the run targets. */
  baseUrl: string;
  /** How long the spec waited, in seconds. */
  windowSeconds: number;
  /** Whether the target name resolves to this machine. */
  loopback: boolean;
  /** Whether a process holds the port. `undefined` when it could not be told. */
  listening: boolean | undefined;
  /** The last connection error, first line only. */
  lastError: string;
}

/** The port a URL asks for, including the one its scheme implies. */
export function targetPort(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.port) return url.port;
  return url.protocol === 'https:' ? '443' : '80';
}

export function unreachableHint(context: UnreachableContext): string {
  const { baseUrl, windowSeconds, loopback, listening, lastError } = context;
  const port = targetPort(baseUrl);
  const opening = `${baseUrl} did not answer within ${windowSeconds}s: ${lastError}`;

  if (!loopback) return opening;

  if (listening === true) {
    // A listener plus a name that resolves here plus no answer is the shape a
    // leftover pf redirect leaves behind: the server is fine, the connection
    // never reaches it. `pnpm local:dev` removes its own rule on exit, so this
    // means a session that was killed, or a rule enabled by hand.
    return (
      `${opening} A process is listening on port ${port} and the name ` +
      'resolves to this machine, so the server is up and something is ' +
      'dropping the connection before it arrives. A port-forwarding rule ' +
      'left over from `pnpm local:dev` does exactly this — run ' +
      '`pnpm local:stop` and try again.'
    );
  }

  if (listening === false) {
    return (
      `${opening} Nothing is listening on port ${port}, so the server is not ` +
      'running: start `pnpm dev`, or let Playwright start it by dropping ' +
      '`E2E_EXTERNAL_SERVER`.'
    );
  }

  return opening;
}
