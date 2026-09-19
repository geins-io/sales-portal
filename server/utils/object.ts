/**
 * Drops explicit `undefined`-valued keys so `{ ...defaults, ...partial }`
 * only overrides fields the caller actually provided. A key present with
 * value `undefined` (e.g. `{ mode: body.mode }` when `body.mode` is unset)
 * survives a plain object spread and silently clobbers the default.
 */
export function withoutUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
