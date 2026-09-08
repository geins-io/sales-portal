import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { CONFIG_COVERAGE_MAP } from './map';
import type { Coverage } from './types';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface Entry {
  path: string;
  coverage: Coverage;
}

function isCoverage(value: unknown): value is Coverage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as { status: unknown }).status === 'string'
  );
}

/**
 * Entries sit at varying depths — a field, a union value, a colour key, one of
 * three string states. Walking for the `status` discriminant reaches all of
 * them without the map having to declare its own shape twice.
 */
function walk(node: unknown, path: string[] = []): Entry[] {
  if (isCoverage(node)) return [{ path: path.join('.'), coverage: node }];
  if (typeof node !== 'object' || node === null) return [];
  return Object.entries(node).flatMap(([key, value]) =>
    walk(value, [...path, key]),
  );
}

const ENTRIES = walk(CONFIG_COVERAGE_MAP);

/** Cache: the same spec is referenced by many entries. */
const sourceCache = new Map<string, string | null>();

function readSpec(spec: string): string | null {
  const cached = sourceCache.get(spec);
  if (cached !== undefined) return cached;
  const absolute = `${REPO_ROOT}${spec}`;
  const source = existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
  sourceCache.set(spec, source);
  return source;
}

describe('tenant config coverage map', () => {
  it('walks to a non-trivial number of entries', () => {
    // Guards the walker itself: a shape change that made walk() return nothing
    // would otherwise turn the two checks below into vacuous passes.
    expect(ENTRIES.length).toBeGreaterThan(100);
  });

  it('every referenced spec exists and contains the referenced title', () => {
    const broken: string[] = [];

    for (const { path, coverage } of ENTRIES) {
      const ref =
        coverage.status === 'has-test' || coverage.status === 'no-consumer'
          ? coverage.test
          : undefined;
      if (!ref) continue;

      const source = readSpec(ref.spec);
      if (source === null) {
        broken.push(`${path}: no such file ${ref.spec}`);
        continue;
      }
      if (!source.includes(ref.title)) {
        broken.push(
          `${path}: ${ref.spec} has no title ${JSON.stringify(ref.title)}`,
        );
      }
    }

    expect(broken).toEqual([]);
  });

  it('every uncovered entry carries a reason', () => {
    const silent = ENTRIES.filter(
      ({ coverage }) =>
        coverage.status !== 'has-test' && coverage.note.trim().length === 0,
    ).map(({ path }) => path);

    expect(silent).toEqual([]);
  });

  it('lists every uncovered entry', () => {
    const noConsumer = ENTRIES.filter(
      ({ coverage }) => coverage.status === 'no-consumer',
    );
    const noTest = ENTRIES.filter(
      ({ coverage }) => coverage.status === 'no-test',
    );
    const hasTest = ENTRIES.length - noConsumer.length - noTest.length;

    const lines = [
      '',
      'Tenant config coverage map',
      `  ${hasTest} with a test · ${noTest.length} without a test · ${noConsumer.length} without a consumer · ${ENTRIES.length} total`,
    ];

    if (noConsumer.length > 0) {
      lines.push(
        '',
        '  No consumer reads these — the question is whether they should exist:',
      );
      for (const { path, coverage } of noConsumer) {
        lines.push(`    ${path}`);
        if (coverage.status === 'no-consumer' && coverage.test) {
          lines.push(
            `      carried, with transport asserted in ${coverage.test.spec}`,
          );
        }
      }
    }

    if (noTest.length > 0) {
      lines.push('', '  A consumer exists and nothing asserts it:');
      for (const { path, coverage } of noTest) {
        if (coverage.status !== 'no-test') continue;
        lines.push(`    ${path} → ${coverage.consumer}`);
      }
    }

    lines.push('');
    console.info(lines.join('\n'));

    // Deliberately not an assertion on the count. See the header of map.ts:
    // this becomes `expect(noTest).toHaveLength(0)` when it can be zero.
    expect(ENTRIES.length).toBeGreaterThan(0);
  });
});
