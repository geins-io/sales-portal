/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  // Stryker resolves plugins by globbing its own directory, which under pnpm
  // holds nothing but core itself, so the runner has to be named here.
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: ['server/utils/is-page-path.ts'],
  // Keeps .nuxt in the sandbox copy: it is gitignored, and without it the vitest
  // config resolves .nuxt/tsconfig.app.json inside the copy and the run dies before
  // the first mutant. After `pnpm clean` the directory must be rebuilt first.
  ignorePatterns: ['!.nuxt'],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html'],
  tempDirName: '.stryker-tmp',
};
