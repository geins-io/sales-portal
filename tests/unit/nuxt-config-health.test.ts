/**
 * The production RSS thresholds live in two places — `runtimeConfig.health` in
 * `nuxt.config.ts` and the fallbacks in `server/utils/health-memory.ts` —
 * because the endpoint must behave as production even when the config carries
 * nothing. This binds them so they cannot drift.
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

describe('nuxt.config.ts health thresholds', () => {
  const base = runtimeConfigHealthBlock();

  it('parses a health block out of runtimeConfig', () => {
    expect(base).not.toBe('');
  });

  it('defaults to the production thresholds the endpoint falls back to', () => {
    expect(numberEntry(base, 'rssDegradedMb')).toBe(DEFAULT_RSS_DEGRADED_MB);
    expect(numberEntry(base, 'rssUnhealthyMb')).toBe(DEFAULT_RSS_UNHEALTHY_MB);
  });

  it('declares nothing but the two thresholds', () => {
    // The decision gate, not the protection: a new key here should cost
    // someone a decision rather than slide in. What actually makes a kill
    // switch impossible is `const gradeRss = !isDevMode()` in the endpoint,
    // proved as behaviour by `ignores a gradeRss key in the configuration`
    // in tests/server/health-memory.test.ts — a regex over a config file
    // could never see a switch that lives somewhere else.
    const keys = [...base.matchAll(/^\s*([A-Za-z]\w*)\s*:/gm)].map((m) => m[1]);

    expect(keys).toEqual(['rssDegradedMb', 'rssUnhealthyMb']);
  });
});
