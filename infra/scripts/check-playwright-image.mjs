#!/usr/bin/env node
// Fails when a workflow's Playwright image tag differs from the installed
// @playwright/test version. The e2e jobs run in that image and use its baked-in
// browsers, which only match the library of the same version.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { version } = createRequire(import.meta.url)(
  '@playwright/test/package.json',
);

const workflowsDir = new URL('../../.github/workflows/', import.meta.url);
const tags = readdirSync(workflowsDir)
  .filter((file) => /\.ya?ml$/.test(file))
  .flatMap((file) =>
    [
      ...readFileSync(new URL(file, workflowsDir), 'utf8').matchAll(
        /mcr\.microsoft\.com\/playwright:v(\d[^\s'"-]*)/g,
      ),
    ].map(([, tag]) => ({ file, tag })),
  );

// Each of these runs in the image. One without a tag the regex finds would
// otherwise go unchecked while the others keep this green.
const E2E_WORKFLOWS = ['ci.yml', 'e2e-full.yml', 'e2e-order-placement.yml'];
const untagged = E2E_WORKFLOWS.filter(
  (file) => !tags.some((found) => found.file === file),
);
if (untagged.length) {
  for (const file of untagged) {
    console.error(
      `.github/workflows/${file}: no mcr.microsoft.com/playwright:v<version> image found`,
    );
  }
  process.exit(1);
}

const drifted = tags.filter(({ tag }) => tag !== version);
if (drifted.length) {
  for (const { file, tag } of drifted) {
    console.error(
      `.github/workflows/${file}: playwright image v${tag}, @playwright/test ${version}`,
    );
  }
  console.error(
    `Set every mcr.microsoft.com/playwright tag to v${version} (or move @playwright/test).`,
  );
  process.exit(1);
}

console.log(
  `Playwright image matches @playwright/test ${version} (${tags.length} tags)`,
);
