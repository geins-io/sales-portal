// Alphabetical by endonym, not tenant-default-first. The collator is pinned
// so the order can't shuffle per UI language.
const collator = new Intl.Collator('en');

/**
 * Order locale codes for display in the locale switcher.
 *
 * `codes` is the tenant's available set — this only reorders it, so a locale
 * the tenant does not offer can never appear. `names` maps code to endonym;
 * a code with no entry sorts on itself.
 */
export function orderLocalesByName(
  codes: readonly string[],
  names: ReadonlyMap<string, string>,
): string[] {
  return [...codes].sort((a, b) =>
    collator.compare(names.get(a) ?? a, names.get(b) ?? b),
  );
}
