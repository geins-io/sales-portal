/**
 * Which listed product a test may buy a given quantity of, and in what order
 * to try them. Kept apart from `helpers.ts` so it runs under vitest: the PDP
 * probe needs a browser, the choice does not.
 */

export interface StockedCandidate {
  alias: string;
  productId?: number | string;
  stock?: {
    totalStock?: number;
    oversellable?: number;
    static?: number;
  } | null;
}

/**
 * The configurator fixture's seeds (Arbetsbord Pro, Skåpsektion Pro). Under
 * the fixture backend they are configurable and `configurator.spec.ts` relies
 * on their live stock — Arbetsbord Pro must hold exactly one unit — so a test
 * on the merchant-api backend, where they are ordinary products, must not buy
 * them.
 */
export const FIXTURE_SEED_PRODUCT_IDS = ['1101', '1102'];

/**
 * Units the PDP lets a buyer add with an empty cart: unlimited for
 * oversellable or static stock and for no stock at all, as `stockLeft` in
 * `app/utils/stock-in-cart.ts` decides.
 */
export function unitsAvailable(stock: StockedCandidate['stock']): number {
  if (!stock) return Number.POSITIVE_INFINITY;
  if ((stock.oversellable ?? 0) > 0 || (stock.static ?? 0) > 0) {
    return Number.POSITIVE_INFINITY;
  }
  return stock.totalStock ?? 0;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The candidates with stock for `quantity`, highest stock first, so repeated
 * purchases spread over the catalogue instead of draining one product. Throws
 * rather than returning nothing: an empty list would end as a test timeout.
 */
export function purchaseCandidates<T extends StockedCandidate>(
  candidates: T[],
  quantity: number,
): T[] {
  const eligible = candidates
    .filter((c) => !FIXTURE_SEED_PRODUCT_IDS.includes(String(c.productId)))
    .map((c) => ({ candidate: c, units: unitsAvailable(c.stock) }))
    .sort(
      // Two unlimited stocks subtract to NaN, which falls through to the alias.
      (a, b) =>
        b.units - a.units || a.candidate.alias.localeCompare(b.candidate.alias),
    );

  const enough = eligible.filter((e) => e.units >= quantity);
  if (enough.length > 0) return enough.map((e) => e.candidate);

  const read = plural(candidates.length, 'candidate');
  const best = eligible[0];
  throw new Error(
    `No product has stock for ${plural(quantity, 'unit')}: ` +
      (best
        ? `the best is "${best.candidate.alias}" with ${best.units} ` +
          `(read ${read}, the fixture seeds left out).`
        : `no candidate is left once the fixture seeds are out (read ${read}).`),
  );
}
