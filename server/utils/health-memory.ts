/**
 * How `/api/health` grades the process's memory use.
 *
 * The RSS thresholds model one thing: a container approaching its limit. They
 * are meaningful where that limit exists — the deployed app runs in a ~1 GB
 * container — and meaningless in a Nuxt dev server, which holds Vite, HMR and
 * source maps in the same process and has no limit but the machine's RAM.
 *
 * Measured on one machine: a settled dev server sits at 651 MB, one e2e suite
 * takes it to 3529 MB, and a second suite against the same process peaks at
 * 3982 MB without ever returning below 2.9 GB. The floor rises with the work
 * done rather than settling, so no fixed number separates "out of memory"
 * from "normal Vite" there. Development therefore reports the numbers and
 * grades nothing (`gradeRss: false` in `$development`, `nuxt.config.ts`); a
 * dev server that has genuinely run out of memory stops answering, which the
 * e2e preflight sees as a dead process rather than as a 503 it must ignore.
 */

/** RSS above this is `degraded`. The production container's warning level. */
export const DEFAULT_RSS_DEGRADED_MB = 400;

/** RSS above this is `unhealthy`, approaching a typical 1 GB container limit. */
export const DEFAULT_RSS_UNHEALTHY_MB = 900;

/** `runtimeConfig.health`, as it arrives — env overrides may be strings. */
export interface HealthMemoryConfig {
  gradeRss?: unknown;
  rssDegradedMb?: unknown;
  rssUnhealthyMb?: unknown;
}

export interface MemoryGrading {
  /** Whether RSS decides the status at all. */
  gradeRss: boolean;
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
 * The grading that applies to a request. Everything absent, unparseable or
 * out of range falls back to the production values — a deployment that
 * configures nothing is graded exactly as it is today, and only an explicit
 * `false` turns grading off.
 */
export function resolveMemoryGrading(
  health?: HealthMemoryConfig,
): MemoryGrading {
  return {
    gradeRss: health?.gradeRss !== false && health?.gradeRss !== 'false',
    degradedMb: thresholdMb(health?.rssDegradedMb, DEFAULT_RSS_DEGRADED_MB),
    unhealthyMb: thresholdMb(health?.rssUnhealthyMb, DEFAULT_RSS_UNHEALTHY_MB),
  };
}
