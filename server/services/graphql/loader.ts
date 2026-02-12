import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const cache = new Map<string, string>();

/**
 * Fragment definitions keyed by name.
 * Loaded once on first access, cached for the lifetime of the process.
 */
const fragmentCache = new Map<string, string>();

function loadFragments(): void {
  if (fragmentCache.size > 0) return;

  const fragmentDir = resolve(__dirname, 'fragments');
  const fragments: Record<string, string> = {
    Price: 'price.graphql',
    Stock: 'stock.graphql',
    Sku: 'sku.graphql',
    Variant: 'variant.graphql',
    Meta: 'meta.graphql',
    Campaign: 'campaign.graphql',
    Address: 'address.graphql',
    ListProduct: 'list-product.graphql',
    ListInfo: 'list-info.graphql',
    ListFilters: 'list-filters.graphql',
  };

  for (const [name, file] of Object.entries(fragments)) {
    fragmentCache.set(name, readFileSync(resolve(fragmentDir, file), 'utf-8'));
  }
}

/**
 * Finds all fragment spreads (`...FragmentName`) in a query string
 * and recursively collects the required fragment definitions.
 */
function resolveFragments(query: string): string {
  loadFragments();

  const resolved = new Set<string>();
  const pending = new Set<string>();

  // Find all fragment spreads in the query
  const spreadRegex = /\.\.\.(\w+)/g;
  let match;
  while ((match = spreadRegex.exec(query)) !== null) {
    const name = match[1] as string;
    if (fragmentCache.has(name)) {
      pending.add(name);
    }
  }

  // Recursively resolve fragment dependencies
  while (pending.size > 0) {
    const name = pending.values().next().value!;
    pending.delete(name);
    if (resolved.has(name)) continue;

    const fragmentDef = fragmentCache.get(name)!;
    resolved.add(name);

    // Check this fragment for its own dependencies
    let innerMatch;
    const innerRegex = /\.\.\.(\w+)/g;
    while ((innerMatch = innerRegex.exec(fragmentDef)) !== null) {
      const dep = innerMatch[1] as string;
      if (fragmentCache.has(dep) && !resolved.has(dep)) {
        pending.add(dep);
      }
    }
  }

  // Build full query with fragments appended (dependencies first)
  const fragmentDefs = [...resolved]
    .map((name) => fragmentCache.get(name)!)
    .join('\n');

  return fragmentDefs ? `${query}\n${fragmentDefs}` : query;
}

/**
 * Loads a `.graphql` file by path relative to the graphql directory,
 * resolves fragment dependencies, and caches the result.
 *
 * @example
 * ```ts
 * const query = loadQuery('products/product.graphql');
 * ```
 */
export function loadQuery(relativePath: string): string {
  const cached = cache.get(relativePath);
  if (cached) return cached;

  const fullPath = resolve(__dirname, relativePath);
  const raw = readFileSync(fullPath, 'utf-8');
  const resolved = resolveFragments(raw);

  cache.set(relativePath, resolved);
  return resolved;
}
