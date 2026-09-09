/**
 * The production memory grading lives in two places — `runtimeConfig.health`
 * in `nuxt.config.ts` and the fallbacks in `server/utils/health-memory.ts` —
 * because the endpoint must behave as production even when the config carries
 * nothing. This binds them so they cannot drift, and pins what `$development`
 * is allowed to change: whether RSS is graded, never how much is healthy.
 *
 * Read as source text, not imported: `defineNuxtConfig` is a Nuxt auto-import
 * that does not exist in a plain unit-test environment.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_RSS_DEGRADED_MB,
  DEFAULT_RSS_UNHEALTHY_MB,
} from '../../server/utils/health-memory';

const configSource = readFileSync(
  resolve(__dirname, '../../nuxt.config.ts'),
  'utf-8',
);

/** The `health: { ... }` block inside the `$development` override, if any. */
function developmentHealthBlock(): string {
  const block =
    /\$development\s*:\s*\{[\s\S]*?health\s*:\s*\{([\s\S]*?)\}/.exec(
      configSource,
    );
  return block?.[1] ?? '';
}

/** The `health: { ... }` block of the top-level `runtimeConfig`. */
function runtimeConfigHealthBlock(): string {
  const source = configSource.slice(
    configSource.search(/^ {2}runtimeConfig: \{/m),
  );
  const block = /health\s*:\s*\{([\s\S]*?)\}/.exec(source);
  return block?.[1] ?? '';
}

function numberEntry(block: string, key: string): number | undefined {
  const match = new RegExp(`${key}\\s*:\\s*(-?\\d+)`).exec(block);
  return match ? Number(match[1]) : undefined;
}

describe('nuxt.config.ts health memory grading', () => {
  const base = runtimeConfigHealthBlock();
  const development = developmentHealthBlock();

  it('parses a health block out of runtimeConfig', () => {
    expect(base).not.toBe('');
  });

  it('defaults to the production thresholds the endpoint falls back to', () => {
    expect(numberEntry(base, 'rssDegradedMb')).toBe(DEFAULT_RSS_DEGRADED_MB);
    expect(numberEntry(base, 'rssUnhealthyMb')).toBe(DEFAULT_RSS_UNHEALTHY_MB);
  });

  it('grades RSS by default, so a build that overrides nothing grades it', () => {
    expect(base).toMatch(/gradeRss\s*:\s*true/);
  });

  it('turns grading off for the dev server', () => {
    expect(development).toMatch(/gradeRss\s*:\s*false/);
  });

  it('leaves both thresholds alone in $development', () => {
    // A raised dev threshold would be a number chosen from how much has been
    // run rather than from what is healthy; the dev server is ungraded instead.
    expect(numberEntry(development, 'rssDegradedMb')).toBeUndefined();
    expect(numberEntry(development, 'rssUnhealthyMb')).toBeUndefined();
  });
});
