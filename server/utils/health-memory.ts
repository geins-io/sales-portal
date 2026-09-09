/**
 * The RSS thresholds `/api/health` grades the process against.
 *
 * They model one thing: a container approaching its limit. Azure's Health
 * Check points at `/api/health` (`infra/modules/webApp.bicep`) and takes an
 * instance out of rotation and restarts it on a 5xx, so the `unhealthy` verdict
 * is production's recovery from a leaking container rather than a report. That
 * is why nothing here can switch grading off — only the sizes are configurable,
 * for a container of a different size.
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

/** RSS above this is `degraded`. The production container's warning level. */
export const DEFAULT_RSS_DEGRADED_MB = 400;

/** RSS above this is `unhealthy`, approaching a typical 1 GB container limit. */
export const DEFAULT_RSS_UNHEALTHY_MB = 900;

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
