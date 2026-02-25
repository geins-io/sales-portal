/**
 * Unwrap a GraphQL response that has a single root key.
 *
 * The Geins SDK's `parseResult` strips the outer `data` wrapper but leaves
 * the query-name key, e.g. `{ product: {...} }` or `{ categories: [...] }`.
 * This utility extracts the inner value so services return flat data.
 *
 * If the result is already flat (array, null, primitive), it's returned as-is.
 */
export function unwrapGraphQL(result: unknown): unknown {
  if (result === null || result === undefined) return result;
  if (typeof result !== 'object' || Array.isArray(result)) return result;

  const keys = Object.keys(result as Record<string, unknown>);
  if (keys.length === 1) {
    return (result as Record<string, unknown>)[keys[0]!];
  }

  // Multiple keys or empty object — return as-is
  return result;
}
