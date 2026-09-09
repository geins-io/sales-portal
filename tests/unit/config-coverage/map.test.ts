import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { CONFIG_COVERAGE_MAP } from './map';
import type { Coverage, TestRef } from './types';

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

/**
 * An entry carries one reference or a list of them; every check below wants
 * the list form, so the widening happens once here.
 */
function refsOf(coverage: Coverage): TestRef[] {
  const ref = coverage.test;
  if (!ref) return [];
  return Array.isArray(ref) ? ref : [ref];
}

/**
 * What lets an entry claim `has-test`: a consumer test that received the
 * configured value itself, or one that received a stubbed decision plus a
 * reader test on the same cell that binds that decision to the value.
 *
 * The composition rests on three things the map cannot check, so they are
 * written here instead:
 *
 *   - the consumer test binds the key. `mockCanAccess.mockImplementation(
 *     (name) => name === 'orderPlacement')` fails if the component asks for
 *     anything else; a blanket `mockReturnValue(true)` answers for every key
 *     and is not consumer proof for any of them;
 *   - the reader is a key-agnostic lookup — `useFeatureAccess` calls
 *     `canAccessFeature(features.value?.[featureName], user)` with no per-key
 *     logic — which is the only reason a reader test on a synthetic key proves
 *     cell → decision for every feature. Add an `if (name === 'quotes')` to a
 *     reader and every composition below it is void;
 *   - the reader reference on a cell exercises that cell's branch. `all` and
 *     `absent` are two branches of `canAccessFeature`, not one.
 */
function qualifiesAsHasTest(refs: TestRef[]): boolean {
  const consumers = refs.filter(
    (ref) => ref.kind === 'consumer' && ref.drives !== 'stub',
  );
  if (consumers.length === 0) return false;
  if (consumers.some((ref) => ref.drives === 'field')) return true;
  return refs.some((ref) => ref.kind === 'reader');
}

const FEATURE_PATH = /^features\.([^.]+)\./;

/**
 * Consumer references on a feature cell whose title may not name the key,
 * each with the reason. A reason is required: an entry without one fails the
 * check below, so the list cannot grow into a dumping ground.
 */
const KEY_IN_TITLE_EXEMPT: ReadonlyArray<{
  spec: string;
  title: string;
  reason: string;
}> = [
  {
    spec: 'tests/components/auth/AuthCard.test.ts',
    title: 'shows affordances (fail-open) when features is undefined',
    reason:
      'The fixture has no features object at all; the test proves the fall-open branch, and a title naming the key would be untrue.',
  },
  {
    spec: 'tests/server/api/auth-register.test.ts',
    title: 'proceeds (fail-open) when tenant context is absent',
    reason:
      'The fixture has no tenant context at all; the test proves the fall-open branch, and a title naming the key would be untrue.',
  },
];

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
      for (const ref of refsOf(coverage)) {
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
    }

    expect(broken).toEqual([]);
  });

  it('checks every reference of an entry that carries a list', () => {
    // Guards refsOf: were it to read only the first element, the widening
    // would silently stop verifying the references added alongside it.
    const listed = ENTRIES.filter(({ coverage }) =>
      Array.isArray(coverage.test),
    );

    expect(listed.length).toBeGreaterThan(0);
    for (const { path, coverage } of listed) {
      const refs = refsOf(coverage);
      expect(refs.length, path).toBeGreaterThan(1);
    }
  });

  it('every uncovered entry carries a reason', () => {
    const silent = ENTRIES.filter(
      ({ coverage }) =>
        coverage.status !== 'has-test' && coverage.note.trim().length === 0,
    ).map(({ path }) => path);

    expect(silent).toEqual([]);
  });

  it('gives has-test only to entries a consumer test qualifies, and to all of them', () => {
    // The type cannot say "at least one member of this list is a consumer",
    // so the rule lives here, in both directions: an entry that claims
    // has-test without qualifying, and an entry that qualifies while still
    // labelled no-test.
    const overclaimed = ENTRIES.filter(
      ({ coverage }) =>
        coverage.status === 'has-test' && !qualifiesAsHasTest(refsOf(coverage)),
    ).map(({ path }) => path);
    const underclaimed = ENTRIES.filter(
      ({ coverage }) =>
        coverage.status === 'no-test' && qualifiesAsHasTest(refsOf(coverage)),
    ).map(({ path }) => path);
    // A consumer test on a value nothing reads is a contradiction in terms.
    const contradicted = ENTRIES.filter(
      ({ coverage }) =>
        coverage.status === 'no-consumer' &&
        refsOf(coverage).some((ref) => ref.kind === 'consumer'),
    ).map(({ path }) => path);

    expect({ overclaimed, underclaimed, contradicted }).toEqual({
      overclaimed: [],
      underclaimed: [],
      contradicted: [],
    });
  });

  it('gives one (spec, title) the same kind on every entry', () => {
    // A kind is a property of the test, not of the entry it is hung on. Two
    // kinds for one title mean a consumer naming is wrong somewhere — or that
    // three kinds are one too few, which is worth knowing before guessing.
    // `drives` may differ across cells (a stubbed canAccess on a feature cell,
    // a stubbed isCatalogMode on a mode cell) but not within one.
    const seen = new Map<string, { kind: string; path: string }>();
    const conflicts: string[] = [];

    for (const { path, coverage } of ENTRIES) {
      const drivesHere = new Map<string, string | undefined>();
      for (const ref of refsOf(coverage)) {
        const key = `${ref.spec} · ${ref.title}`;
        const first = seen.get(key);
        if (!first) {
          seen.set(key, { kind: ref.kind, path });
        } else if (first.kind !== ref.kind) {
          conflicts.push(
            `${key}: ${first.kind} on ${first.path}, ${ref.kind} on ${path}`,
          );
        }
        if (drivesHere.has(key) && drivesHere.get(key) !== ref.drives) {
          conflicts.push(`${key}: two drives on ${path}`);
        }
        drivesHere.set(key, ref.drives);
      }
    }

    expect(seen.size).toBeGreaterThan(100);
    expect(conflicts).toEqual([]);
  });

  it('names the feature key in the title of every consumer reference on it', () => {
    // A cheap guard against drift: a component that switches to another key
    // while its test title stays put. Reader references are exempt — they are
    // key-agnostic by design and prove the mechanism on a synthetic key.
    // A blanket stub binds no key, so there is nothing for its title to name.
    const unnamed: string[] = [];
    const unexplained = KEY_IN_TITLE_EXEMPT.filter(
      (exempt) => exempt.reason.trim().length === 0,
    ).map((exempt) => exempt.title);

    for (const { path, coverage } of ENTRIES) {
      const key = FEATURE_PATH.exec(path)?.[1];
      if (!key) continue;
      for (const ref of refsOf(coverage)) {
        if (ref.kind !== 'consumer' || ref.drives === 'stub') continue;
        if (ref.title.includes(key)) continue;
        const exempt = KEY_IN_TITLE_EXEMPT.some(
          (e) => e.spec === ref.spec && e.title === ref.title,
        );
        if (!exempt) unnamed.push(`${path}: ${ref.spec} · ${ref.title}`);
      }
    }

    expect({ unnamed, unexplained }).toEqual({ unnamed: [], unexplained: [] });
  });

  it('lists every uncovered entry', () => {
    const noConsumer = ENTRIES.filter(
      ({ coverage }) => coverage.status === 'no-consumer',
    );
    const noTest = ENTRIES.filter(
      ({ coverage }) => coverage.status === 'no-test',
    );
    const hasTest = ENTRIES.length - noConsumer.length - noTest.length;
    const provedWeakly = noTest.filter(
      ({ coverage }) => refsOf(coverage).length > 0,
    ).length;

    const lines = [
      '',
      'Tenant config coverage map',
      `  ${hasTest} with a consumer test · ${noTest.length} without one (${provedWeakly} of them proved only as carrier or reader) · ${noConsumer.length} without a consumer · ${ENTRIES.length} total`,
    ];

    if (noConsumer.length > 0) {
      lines.push(
        '',
        '  No consumer reads these — the question is whether they should exist:',
      );
      for (const { path, coverage } of noConsumer) {
        lines.push(`    ${path}`);
        for (const ref of refsOf(coverage)) {
          lines.push(`      ${ref.kind} · ${ref.spec}`);
        }
      }
    }

    if (noTest.length > 0) {
      lines.push('', '  A consumer exists and nothing asserts it there:');
      for (const { path, coverage } of noTest) {
        if (coverage.status !== 'no-test') continue;
        lines.push(`    ${path} → ${coverage.consumer}`);
        for (const ref of refsOf(coverage)) {
          const kind =
            ref.drives === 'stub' ? `${ref.kind} (${ref.drives})` : ref.kind;
          lines.push(`      ${kind} · ${ref.spec}`);
        }
      }
    }

    lines.push('');
    console.info(lines.join('\n'));

    // Deliberately not an assertion on the count. See the header of map.ts:
    // this becomes `expect(noTest).toHaveLength(0)` when it can be zero.
    expect(ENTRIES.length).toBeGreaterThan(0);
  });
});
