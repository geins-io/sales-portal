import type { StockType, VariantNode } from '#shared/types/commerce';

export interface VariantCombination {
  alias: string;
  productId: number | null;
  /** Dimension → value, from the top of the tree down to the product node. */
  selection: Record<string, string>;
  /** Dimension → display label, falling back to the value. */
  labels: Record<string, string>;
  stock: StockType | null;
}

export interface VariantDimension {
  dimensionName: string;
  values: { value: string; label: string }[];
}

/**
 * Every variant product in the group with the full path of values leading to
 * it. Nodes above the product node carry no alias, so the walk stops at the
 * first node that has one.
 */
export function variantCombinations(
  variants: readonly VariantNode[] | null | undefined,
): VariantCombination[] {
  const out: VariantCombination[] = [];
  const walk = (
    nodes: readonly VariantNode[] | null | undefined,
    selection: Record<string, string>,
    labels: Record<string, string>,
  ) => {
    for (const node of nodes ?? []) {
      const sel = { ...selection };
      const lab = { ...labels };
      const value = node.value ?? node.label;
      if (node.dimension && value != null) {
        sel[node.dimension] = value;
        lab[node.dimension] = node.label || value;
      }
      if (node.alias) {
        out.push({
          alias: node.alias,
          productId: node.productId || null,
          selection: sel,
          labels: lab,
          stock: node.stock ?? null,
        });
      } else {
        walk(node.variants, sel, lab);
      }
    }
  };
  walk(variants, {}, {});
  return out;
}

/**
 * The variant a pick of `value` on `dimension` leads to: among the variants
 * with that value, the one agreeing with `current` on the most other
 * dimensions, payload order breaking ties.
 */
export function resolveCombination(
  combinations: readonly VariantCombination[],
  current: Record<string, string>,
  dimension: string,
  value: string,
): VariantCombination | null {
  let best: VariantCombination | null = null;
  let bestScore = -1;
  for (const combo of combinations) {
    if (combo.selection[dimension] !== value) continue;
    let score = 0;
    for (const [dim, val] of Object.entries(current)) {
      if (dim !== dimension && combo.selection[dim] === val) score++;
    }
    if (score > bestScore) {
      best = combo;
      bestScore = score;
    }
  }
  return best;
}

/** Whether some variant has `value` on `dimension` and every other value in `current`. */
export function combinationExists(
  combinations: readonly VariantCombination[],
  current: Record<string, string>,
  dimension: string,
  value: string,
): boolean {
  return combinations.some(
    (combo) =>
      combo.selection[dimension] === value &&
      Object.entries(current).every(
        ([dim, val]) => dim === dimension || combo.selection[dim] === val,
      ),
  );
}

export interface ChangeGroup {
  /** The other dimensions these variants change, in dimension order. */
  dimensions: string[];
  combinations: VariantCombination[];
}

/**
 * The variants whose value on `dimension` cannot be picked without changing
 * other current choices, grouped by which ones they change: fewest first,
 * then by dimension order, payload order inside a group.
 */
export function changeGroups(
  combinations: readonly VariantCombination[],
  current: Record<string, string>,
  dimension: string,
): ChangeGroup[] {
  const order = dimensionsOf(combinations).map((d) => d.dimensionName);
  const groups = new Map<string, ChangeGroup>();
  for (const combo of combinations) {
    const value = combo.selection[dimension];
    if (value === undefined || value === current[dimension]) continue;
    if (combinationExists(combinations, current, dimension, value)) continue;
    const changed = order.filter(
      (dim) =>
        dim !== dimension &&
        current[dim] !== undefined &&
        combo.selection[dim] !== current[dim],
    );
    const key = JSON.stringify(changed);
    if (!groups.has(key))
      groups.set(key, { dimensions: changed, combinations: [] });
    groups.get(key)!.combinations.push(combo);
  }
  const rank = (group: ChangeGroup) =>
    group.dimensions.map((d) => order.indexOf(d));
  // Two groups never change the same dimensions, so same-size groups differ
  // at some position.
  return Array.from(groups.values()).sort((a, b) => {
    if (a.dimensions.length !== b.dimensions.length) {
      return a.dimensions.length - b.dimensions.length;
    }
    const ra = rank(a);
    const rb = rank(b);
    const i = ra.findIndex((v, idx) => v !== rb[idx]);
    return ra[i]! - rb[i]!;
  });
}

export function dimensionsOf(
  combinations: readonly VariantCombination[],
): VariantDimension[] {
  const dims = new Map<string, Map<string, string>>();
  for (const combo of combinations) {
    for (const [dim, value] of Object.entries(combo.selection)) {
      if (!dims.has(dim)) dims.set(dim, new Map());
      const values = dims.get(dim)!;
      if (!values.has(value)) values.set(value, combo.labels[dim] ?? value);
    }
  }
  return Array.from(dims, ([dimensionName, values]) => ({
    dimensionName,
    values: Array.from(values, ([value, label]) => ({ value, label })),
  }));
}

/**
 * Geins's names for the dimension of a product without variants and for its
 * SKUs. They label no choice a buyer makes.
 */
const INTERNAL_DIMENSIONS = new Set(['DefaultProduct', 'DefaultSku']);

export function isInternalDimension(name: string): boolean {
  return INTERNAL_DIMENSIONS.has(name);
}
