import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  browserSpecFiles,
  dealLegs,
  filePattern,
  legPatterns,
} from '../e2e/ci-legs.mjs';

/**
 * The CI legs: every spec runs in exactly one leg of each project, and the
 * file arguments take that spec and no other.
 */

const ROOT = resolve(import.meta.dirname, '../..');
const PROJECTS = ['chromium', 'Mobile Chrome', 'webkit'];

/**
 * The spec files Playwright itself collects for a project, from `--list`.
 * CI and E2E_PROD are cleared: either makes the config read the TLS cert,
 * which the unit job does not have, and neither changes what is collected.
 */
function playwrightSpecFiles(project: string): string[] {
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
  const env: NodeJS.ProcessEnv = { ...process.env, E2E_EXTERNAL_SERVER: '1' };
  delete env.CI;
  delete env.E2E_PROD;
  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [
        cli,
        'test',
        '--list',
        '--reporter=json',
        '--no-deps',
        `--project=${project}`,
      ],
      { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 },
    ),
  ) as { suites: { file: string }[] };
  return [...new Set(report.suites.map((suite) => suite.file))].sort();
}

describe('browserSpecFiles', () => {
  it.each(PROJECTS)(
    'is the set Playwright collects for %s',
    (project) => {
      expect(browserSpecFiles()).toEqual(playwrightSpecFiles(project));
    },
    60_000,
  );
});

describe('dealLegs', () => {
  const files = ['a.spec.ts', 'b.spec.ts', 'c.spec.ts', 'd.spec.ts'];

  it('puts every file in exactly one leg', () => {
    const legs = dealLegs(files, { 'a.spec.ts': 5, 'b.spec.ts': 1 }, 3);
    expect(legs.flat().sort()).toEqual(files);
  });

  it('deals the heaviest first to the lightest leg', () => {
    const weights = {
      'a.spec.ts': 10,
      'b.spec.ts': 6,
      'c.spec.ts': 5,
      'd.spec.ts': 1,
    };
    expect(dealLegs(files, weights, 2)).toEqual([
      ['a.spec.ts', 'd.spec.ts'],
      ['b.spec.ts', 'c.spec.ts'],
    ]);
  });

  it('weighs a spec missing from the table at the median, so it still runs', () => {
    const weights = { 'a.spec.ts': 9, 'b.spec.ts': 3, 'c.spec.ts': 1 };
    const legs = dealLegs(files, weights, 2);
    expect(legs.flat().sort()).toEqual(files);
    // d weighs 3, like b: a alone against b, d and c.
    expect(legs).toEqual([
      ['a.spec.ts'],
      ['b.spec.ts', 'c.spec.ts', 'd.spec.ts'],
    ]);
  });

  it('refuses a weight for a spec that does not exist', () => {
    expect(() => dealLegs(files, { 'gone.spec.ts': 4 }, 2)).toThrow(
      /gone\.spec\.ts/,
    );
  });
});

describe('filePattern', () => {
  const matches = (file: string, path: string) =>
    new RegExp(filePattern(file), 'gi').test(path);

  it('takes its own spec and not one whose name ends the same', () => {
    expect(matches('cart.spec.ts', '/r/tests/e2e/cart.spec.ts')).toBe(true);
    expect(matches('cart.spec.ts', '/r/tests/e2e/cart-owner.spec.ts')).toBe(
      false,
    );
    expect(matches('cart.spec.ts', '/r/tests/e2e/quote-cart.spec.ts')).toBe(
      false,
    );
    expect(matches('cart.spec.ts', '/r/tests/e2e/cartXspec.ts')).toBe(false);
  });
});

describe('legPatterns', () => {
  it.each(PROJECTS)(
    'covers every spec once across the legs of %s',
    (project) => {
      for (const legs of [1, 2, 3, 4]) {
        const all = Array.from({ length: legs }, (_, i) =>
          legPatterns(project, `${i + 1}/${legs}`),
        ).flat();
        expect(all.sort()).toEqual(browserSpecFiles().map(filePattern).sort());
      }
    },
  );

  it.each(['0/2', '3/2', '2', 'x/y', ''])('refuses the leg "%s"', (leg) => {
    expect(() => legPatterns('webkit', leg)).toThrow(/<leg>\/<legs>/);
  });

  it('refuses a project the table does not know', () => {
    expect(() => legPatterns('firefox', '1/2')).toThrow(/firefox/);
  });
});
