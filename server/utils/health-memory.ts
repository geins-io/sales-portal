/**
 * The RSS thresholds `/api/health` grades the process against.
 *
 * Both are alarms, not recovery. Production runs a single instance, so
 * Azure's Health Check (`infra/modules/webApp.bicep`) never takes it out of
 * rotation on a 503. Recovery from a heap leak is the runtime's
 * `--max-old-space-size` cap: V8 runs out of heap and the container restarts.
 * Nothing here can switch grading off, so the alarm cannot be silenced — only
 * the sizes are configurable.
 *
 * A Nuxt dev server has no such limit: it holds Vite, HMR and source maps in
 * the same process, and measured on one machine it sits at 651 MB settled,
 * reaches 3529 MB after one e2e suite and 3982 MB after a second against the
 * same process, never returning below 2.9 GB. The floor rises with the work
 * done, so no fixed number separates "out of memory" from "normal Vite" there.
 * The dev server therefore reports its memory ungraded — decided by
 * `isDevMode()`, a build-time constant, not by configuration — and a dev server
 * that has genuinely run out of memory stops answering, which the e2e preflight
 * sees as a dead process.
 */

/**
 * RSS above this is `degraded`. Node 24 under the heap cap settles near 320 MB
 * and stays near 400 after a burst; this keeps a margin over that.
 */
export const DEFAULT_RSS_DEGRADED_MB = 500;

/**
 * RSS above this is `unhealthy`. A healthy process with its heap at the cap
 * sits near 850 MB, so only growth the cap cannot catch (buffers, native
 * memory) gets here.
 */
export const DEFAULT_RSS_UNHEALTHY_MB = 1200;

/** `runtimeConfig.health`, as it arrives — env overrides may be strings. */
export interface HealthMemoryConfig {
  rssDegradedMb?: unknown;
  rssUnhealthyMb?: unknown;
}

export interface RssThresholds {
  degradedMb: number;
  unhealthyMb: number;
}

/**
 * A threshold in MB, or the production default. Nuxt parses
 * `NUXT_HEALTH_RSS_UNHEALTHY_MB=1200` to a number, but a typo arrives as a
 * string and must not be allowed to disable the check by becoming `NaN`.
 */
function thresholdMb(value: unknown, fallback: number): number {
  const mb = typeof value === 'string' ? Number(value) : value;
  if (typeof mb !== 'number' || !Number.isFinite(mb) || mb <= 0) {
    return fallback;
  }
  return mb;
}

/**
 * The thresholds that apply to a request. Everything absent, unparseable or
 * out of range falls back to the production values, so a deployment that
 * configures nothing is graded exactly as it is today.
 */
export function resolveRssThresholds(
  health?: HealthMemoryConfig,
): RssThresholds {
  return {
    degradedMb: thresholdMb(health?.rssDegradedMb, DEFAULT_RSS_DEGRADED_MB),
    unhealthyMb: thresholdMb(health?.rssUnhealthyMb, DEFAULT_RSS_UNHEALTHY_MB),
  };
}

/**
 * `process.getActiveResourcesInfo()` as a count per type. A `TCPSocketWrap`
 * count that only climbs is a connection, in or out, that never closes.
 */
export function countActiveResources(
  resources: readonly string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const type of resources) {
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}
