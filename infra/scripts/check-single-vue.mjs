#!/usr/bin/env node
// Fails when pnpm-lock.yaml resolves more than one version of a Vue runtime
// package. Two copies get bundled side by side and SSR crashes inside
// components that hold refs from the other copy.
import { readFileSync } from 'node:fs';

const PACKAGES = [
  'vue',
  '@vue/runtime-core',
  '@vue/runtime-dom',
  '@vue/server-renderer',
  '@vue/compiler-core',
  '@vue/compiler-dom',
  '@vue/compiler-sfc',
  '@vue/reactivity',
  '@vue/shared',
];

const lockfile = readFileSync(
  new URL('../../pnpm-lock.yaml', import.meta.url),
  'utf8',
);

const versions = new Map(PACKAGES.map((name) => [name, new Set()]));
// Entries under `packages:` and `snapshots:` look like `  vue@3.5.44:` or
// `  '@vue/shared@3.5.44':`, optionally followed by a peer suffix `(...)`.
for (const [, name, version] of lockfile.matchAll(
  /^ {2}'?(@?[^@'\s]+)@(\d[^(':\s]*)/gm,
)) {
  versions.get(name)?.add(version);
}

const missing = [...versions].filter(([, found]) => found.size === 0);
if (missing.length) {
  // Every Nuxt app resolves all of them; none found means the parse broke.
  console.error(
    `Not found in pnpm-lock.yaml: ${missing.map(([name]) => name).join(', ')}`,
  );
  process.exit(1);
}

const duplicates = [...versions].filter(([, found]) => found.size > 1);
if (duplicates.length) {
  for (const [name, found] of duplicates) {
    console.error(`${name}: ${[...found].join(', ')}`);
  }
  console.error(
    'More than one Vue runtime version in pnpm-lock.yaml. Run `pnpm why <package>` to find what pulls the second copy.',
  );
  process.exit(1);
}
console.log(
  `One version each: ${[...versions].map(([name, found]) => `${name}@${[...found].join('')}`).join(', ')}`,
);
