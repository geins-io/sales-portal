/**
 * GraphQL query loader.
 *
 * Uses Vite's `import.meta.glob` with `?raw` to inline all `.graphql` files
 * at build time. Works in both dev and production (no filesystem access needed).
 */

// Eagerly import all .graphql files as raw strings at build time.
// import.meta.glob is a Vite/Nitro build-time transform.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const glob = (import.meta as unknown as { glob: Function }).glob;
const graphqlFiles = glob('./**/*.graphql', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>;

const cache = new Map<string, string>();

/**
 * Fragment definitions keyed by name.
 * Loaded once on first access, cached for the lifetime of the process.
 */
const fragmentCache = new Map<string, string>();

const FRAGMENT_NAMES: Record<string, string> = {
  Price: './fragments/price.graphql',
  Stock: './fragments/stock.graphql',
  Sku: './fragments/sku.graphql',
  Variant: './fragments/variant.graphql',
  Meta: './fragments/meta.graphql',
  Campaign: './fragments/campaign.graphql',
  Address: './fragments/address.graphql',
  ListProduct: './fragments/list-product.graphql',
  ListInfo: './fragments/list-info.graphql',
  ListFilters: './fragments/list-filters.graphql',
};

function loadFragments(): void {
  if (fragmentCache.size > 0) return;

  for (const [name, path] of Object.entries(FRAGMENT_NAMES)) {
    const content = graphqlFiles[path];
    if (content) {
      fragmentCache.set(name, content);
    }
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
 * All `.graphql` files are inlined at build time via `import.meta.glob`.
 *
 * @example
 * ```ts
 * const query = loadQuery('products/product.graphql');
 * ```
 */
export function loadQuery(relativePath: string): string {
  const cached = cache.get(relativePath);
  if (cached) return cached;

  const key = `./${relativePath}`;
  const raw = graphqlFiles[key];

  if (!raw) {
    throw new Error(`GraphQL file not found: ${relativePath}`);
  }

  const resolved = resolveFragments(raw);
  cache.set(relativePath, resolved);
  return resolved;
}
