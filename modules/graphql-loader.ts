/**
 * Nuxt module that collects all `.graphql` files under server/services/graphql/
 * and exposes them as a `#graphql-queries` alias via addTemplate.
 *
 * This is the standard Nuxt pattern used by nuxt-graphql-server and
 * nuxt-graphql-middleware. The generated template is a plain JS module
 * exporting a Record<string, string> (relative path → file content).
 *
 * Works in dev (Vite), tests (Vitest), and production (Nitro/Rollup).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Nuxt } from '@nuxt/schema';
import { addTemplate, defineNuxtModule, updateTemplates } from '@nuxt/kit';

function collectGraphqlFiles(dir: string, base = '.'): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    const relPath = `${base}/${entry.name}`;
    if (entry.isDirectory()) {
      Object.assign(result, collectGraphqlFiles(fullPath, relPath));
    } else if (entry.name.endsWith('.graphql')) {
      result[relPath] = readFileSync(fullPath, 'utf-8');
    }
  }
  return result;
}

function generateModule(graphqlDir: string): string {
  const files = collectGraphqlFiles(graphqlDir);
  const entries = Object.entries(files)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(',\n');
  return `export default {\n${entries}\n};\n`;
}

// Co-located .d.ts so the path alias resolves types in all tsconfig scopes
const TYPES_CONTENT = [
  'declare const files: Record<string, string>;',
  'export default files;',
].join('\n');

export default defineNuxtModule({
  meta: { name: 'graphql-loader' },
  setup(_options: Record<string, never>, nuxt: Nuxt) {
    const graphqlDir = resolve(nuxt.options.rootDir, 'server/services/graphql');

    // Generate the template containing all .graphql file contents
    const { dst } = addTemplate({
      filename: 'graphql-queries.mjs',
      getContents: () => generateModule(graphqlDir),
      write: true,
    });

    // Register the alias so `import X from '#graphql-queries'` resolves
    nuxt.options.alias['#graphql-queries'] = dst;

    // Co-located type declaration alongside the .mjs for path alias resolution
    addTemplate({
      filename: 'graphql-queries.d.ts',
      getContents: () => TYPES_CONTENT,
      write: true,
    });

    // Rebuild the template when .graphql files change in dev
    nuxt.hook('builder:watch', async (_event: string, relativePath: string) => {
      if (relativePath.endsWith('.graphql')) {
        await updateTemplates({
          filter: (t: { filename: string }) =>
            t.filename === 'graphql-queries.mjs',
        });
      }
    });
  },
});
