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
