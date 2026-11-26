import { readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Which spec files one CI leg of a browser project runs.
 *
 *   node tests/e2e/ci-legs.mjs <project> <leg>/<legs>
 *
 * prints one anchored file pattern per line, for `playwright test` to take as
 * its file arguments. `--shard` is not used because it cuts the ordered spec
 * list into equal test counts without looking at time, and the slow specs sit
 * together alphabetically; dealing by measured seconds keeps the legs even.
 *
 * `ci-legs.json` holds those seconds per project and spec file, summed from a
 * green run's Playwright reports. Every spec file is dealt, heaviest first, to
 * the leg with the fewest seconds so far. A spec missing from the table weighs
 * the table's median, so a new spec always runs somewhere; an entry with no
 * spec file is an error, so a rename cannot leave a stale weight behind.
 *
 * Plain ESM so the CI step runs it with node before Playwright starts.
 */

const E2E_DIR = import.meta.dirname;

/**
 * Spec files the browser projects collect: `testMatch: '**\/*.spec.ts'`
 * under the test dir, less the preflight and order-placement folders
 * (`playwright.config.ts`). Paths are relative to tests/e2e, with `/`.
 *
 * @param {string} [dir]
 * @returns {string[]}
 */
export function browserSpecFiles(dir = E2E_DIR) {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(sep).join('/'))
    .filter((file) => file.endsWith('.spec.ts'))
    .filter((file) => !/(^|\/)(preflight|orders)\//.test(file))
    .sort();
}

/**
 * @param {string[]} files
 * @param {Record<string, number>} weights  seconds per spec file
 * @param {number} legs
 * @returns {string[][]}  the files of each leg
 */
export function dealLegs(files, weights, legs) {
  const stale = Object.keys(weights).filter((file) => !files.includes(file));
  if (stale.length) {
    throw new Error(`ci-legs.json names specs that do not exist: ${stale}`);
  }
  const known = Object.values(weights).sort((a, b) => a - b);
  const median = known.length ? known[Math.floor(known.length / 2)] : 1;
  const weighOf = (file) => weights[file] ?? median;

  const dealt = Array.from({ length: legs }, () => ({ seconds: 0, files: [] }));
  const heaviestFirst = [...files].sort(
    (a, b) => weighOf(b) - weighOf(a) || a.localeCompare(b),
  );
  for (const file of heaviestFirst) {
    const lightest = dealt.reduce((min, leg) =>
      leg.seconds < min.seconds ? leg : min,
    );
    lightest.seconds += weighOf(file);
    lightest.files.push(file);
  }
  return dealt.map((leg) => leg.files.sort());
}

/**
 * A file argument Playwright reads as a regular expression against the
 * absolute path, anchored so `cart.spec.ts` cannot also take
 * `cart-owner.spec.ts`.
 *
 * @param {string} file
 * @returns {string}
 */
export function filePattern(file) {
  const escaped = `tests/e2e/${file}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `${escaped}$`;
}

/**
 * @param {string} project
 * @param {string} legOfLegs  e.g. "2/4"
 * @returns {string[]}
 */
export function legPatterns(project, legOfLegs) {
  const match = /^(\d+)\/(\d+)$/.exec(legOfLegs);
  const leg = Number(match?.[1]);
  const legs = Number(match?.[2]);
  if (!match || leg < 1 || leg > legs) {
    throw new Error(
      `leg must be <leg>/<legs> with 1 <= leg <= legs: ${legOfLegs}`,
    );
  }
  const table = JSON.parse(
    readFileSync(resolve(E2E_DIR, 'ci-legs.json'), 'utf8'),
  );
  const weights = table[project];
  if (!weights) throw new Error(`ci-legs.json has no project "${project}"`);
  return dealLegs(browserSpecFiles(), weights, legs)[leg - 1].map(filePattern);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [project = '', legOfLegs = ''] = process.argv.slice(2);
  console.log(legPatterns(project, legOfLegs).join('\n'));
}
