import type { SkuType } from '@geins/types';
import type { ProductImageType, StockType } from '#shared/types/commerce';
import {
  combinationExists,
  dimensionsOf,
  isInternalDimension,
  resolveCombination,
  type VariantCombination,
  type VariantDimension,
} from './variant-tree';

/**
 * Every trigger that opens a variant choice. The 4 px corners are fixed: the
 * store's radius rounds the buy buttons, not these rows.
 */
export const VARIANT_TRIGGER_CLASS =
  'border-input bg-muted/50 hover:bg-muted flex h-11 w-full items-center justify-between rounded-[4px] px-3 font-normal shadow-none lg:max-w-80';

/** How tall a variant dropdown's list grows before it scrolls. */
export const VARIANT_LIST_HEIGHT = 'max-h-80';

/** Search shows from this many rows; a shorter list is read at a glance. */
export const VARIANT_SEARCH_FROM = 8;

export type VariantRowImage = Pick<ProductImageType, 'fileName' | 'url'>;

/** One choice in an ungrouped list: a variant, or one of the product's SKUs. */
export interface VariantRow {
  key: string;
  /** The choice itself: "Svart, M", or the SKU's name. */
  label: string;
  /** The product's name. */
  name: string;
  articleNumber: string | null;
  stock: StockType | null;
  price: string | null;
  /** Undefined while not known yet, null when there is none. */
  image: VariantRowImage | null | undefined;
  selected: boolean;
}

/** What the parent knows of each variant product, by alias. */
export interface VariantRowMeta {
  name?: string | null;
  articleNumber?: string | null;
  priceIncVatFormatted?: string | null;
  priceExVatFormatted?: string | null;
  image?: VariantRowImage | null;
}

/** The product's own values, for a variant or SKU that has none. */
export interface VariantRowFallback {
  productName: string;
  articleNumber: string | null;
  priceIncVatFormatted: string | null;
  priceExVatFormatted: string | null;
  image: VariantRowImage | null;
}

const isNamed = (name: string) => !!name.trim() && !isInternalDimension(name);

/**
 * "Svart, M": the variant's values, top dimension first. Geins's internal
 * dimensions are left out, unless the variant has no other.
 */
export function combinationLabel(combo: VariantCombination): string {
  const labels = Object.entries(combo.labels);
  const named = labels.filter(([dim]) => !isInternalDimension(dim));
  return (named.length ? named : labels).map(([, label]) => label).join(', ');
}

function fallbackPrice(
  fallback: VariantRowFallback,
  showIncVat: boolean,
): string | null {
  return (
    (showIncVat
      ? fallback.priceIncVatFormatted
      : fallback.priceExVatFormatted) || null
  );
}

export function combinationRows(
  combinations: readonly VariantCombination[],
  current: Record<string, string>,
  meta: Record<string, VariantRowMeta | undefined> | undefined,
  fallback: VariantRowFallback,
  showIncVat: boolean,
): VariantRow[] {
  return combinations.map((combo) => {
    const own = meta?.[combo.alias];
    const ownPrice = showIncVat
      ? own?.priceIncVatFormatted
      : own?.priceExVatFormatted;
    return {
      key: combo.alias,
      label: combinationLabel(combo),
      name: own?.name || fallback.productName,
      articleNumber: own?.articleNumber || fallback.articleNumber,
      stock: combo.stock,
      price: ownPrice || fallbackPrice(fallback, showIncVat),
      image: own?.image,
      selected: Object.entries(combo.selection).every(
        ([dim, value]) => current[dim] === value,
      ),
    };
  });
}

/** The product's own SKUs. They share the product's price and image. */
export function skuRows(
  skus: readonly SkuType[],
  skuId: number | null | undefined,
  fallback: VariantRowFallback,
  showIncVat: boolean,
): VariantRow[] {
  return skus.map((sku) => ({
    key: String(sku.skuId),
    label: sku.name || sku.articleNumber || '',
    name: fallback.productName,
    articleNumber: sku.articleNumber || null,
    stock: sku.stock ?? null,
    price: fallbackPrice(fallback, showIncVat),
    image: fallback.image,
    selected: sku.skuId === skuId,
  }));
}

export function showsSearch(rows: readonly VariantRow[]): boolean {
  return rows.length >= VARIANT_SEARCH_FROM;
}

/** Rows whose values or article number hold the query, case ignored. */
export function filterRows(rows: VariantRow[], query: string): VariantRow[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.label, row.articleNumber].some((text) =>
      text?.toLocaleLowerCase().includes(q),
    ),
  );
}

/**
 * The dimensions a buyer chooses on. A product without variants still carries
 * one internal dimension, its own name the only value; that is no choice.
 */
export function visibleDimensions(
  combinations: readonly VariantCombination[],
): VariantDimension[] {
  return dimensionsOf(combinations).filter(
    (d) => !isInternalDimension(d.dimensionName) || d.values.length > 1,
  );
}

export interface DimensionSelectGroup {
  key: string;
  kind: 'matching' | 'change';
  /** The other dimensions a pick in this group changes. */
  dimensions: string[];
  values: { value: string; label: string }[];
}

/**
 * The values of `dimension` that keep the other current choices, then the
 * rest, each under the other choices its pick changes: the variant the pick
 * leads to (resolveCombination) decides, so a heading never says more or less
 * than the pick does. Fewest changes first, then dimension order.
 */
export function dimensionSelectGroups(
  combinations: readonly VariantCombination[],
  current: Record<string, string>,
  dimension: string,
): DimensionSelectGroup[] {
  const dims = dimensionsOf(combinations);
  const dim = dims.find((d) => d.dimensionName === dimension);
  if (!dim) return [];
  const others = dims
    .map((d) => d.dimensionName)
    .filter((d) => d !== dimension);
  const matching: DimensionSelectGroup = {
    key: 'matching',
    kind: 'matching',
    dimensions: [],
    values: [],
  };
  const changes = new Map<string, DimensionSelectGroup>();
  for (const v of dim.values) {
    if (combinationExists(combinations, current, dimension, v.value)) {
      matching.values.push(v);
      continue;
    }
    const target = resolveCombination(
      combinations,
      current,
      dimension,
      v.value,
    )!;
    const changed = others.filter((d) => target.selection[d] !== current[d]);
    const key = changed.join('-');
    if (!changes.has(key)) {
      changes.set(key, {
        key,
        kind: 'change',
        dimensions: changed,
        values: [],
      });
    }
    changes.get(key)!.values.push(v);
  }
  const rank = (group: DimensionSelectGroup) =>
    group.dimensions.map((d) => others.indexOf(d));
  const sorted = [...changes.values()].sort((a, b) => {
    if (a.dimensions.length !== b.dimensions.length) {
      return a.dimensions.length - b.dimensions.length;
    }
    const ra = rank(a);
    const rb = rank(b);
    const i = ra.findIndex((r, idx) => r !== rb[idx]);
    return ra[i]! - rb[i]!;
  });
  return matching.values.length ? [matching, ...sorted] : sorted;
}

export interface GroupHeading {
  key: string;
  params?: Record<string, string>;
}

/** "A, B and C": Intl.ListFormat's default is the conjunction. */
const listFormat = (locale: string, items: string[]) =>
  new Intl.ListFormat(locale).format(items);

/**
 * "Matches Effekt: 0,66 kW" names the one other dimension and its value; a
 * nameless one leaves the value. Several others are listed, "Matches Poler:
 * 3P and Kapsling: IP65", unless one has no name. While any other dimension
 * has no value, the heading stays neutral. The panel words it the same way.
 */
export function matchingHeading(
  dimensions: readonly VariantDimension[],
  current: Record<string, string>,
  dimension: string,
  locale: string,
): GroupHeading {
  const neutral = { key: 'product.variant_group_matching' };
  const labelFor = (dim: VariantDimension, value: string) =>
    dim.values.find((v) => v.value === value)?.label ?? value;
  const others = dimensions.filter((d) => d.dimensionName !== dimension);
  if (others.length > 1) {
    const choices = others.map((dim) => {
      const value = current[dim.dimensionName];
      return value && isNamed(dim.dimensionName)
        ? `${dim.dimensionName}: ${labelFor(dim, value)}`
        : null;
    });
    if (choices.includes(null)) return neutral;
    return {
      key: 'product.variant_group_matching_with',
      params: { value: listFormat(locale, choices as string[]) },
    };
  }
  const other = others[0];
  const value = other ? current[other.dimensionName] : undefined;
  if (!other || !value) return neutral;
  return isNamed(other.dimensionName)
    ? {
        key: 'product.variant_group_matching_named',
        params: {
          dimension: other.dimensionName,
          value: labelFor(other, value),
        },
      }
    : {
        key: 'product.variant_group_matching_with',
        params: { value: labelFor(other, value) },
      };
}

/** "More options, changes Poler and Kapsling". */
export function changeHeading(
  dimensions: readonly string[],
  locale: string,
): GroupHeading {
  if (!dimensions.every(isNamed)) return { key: 'product.variant_group_more' };
  return {
    key: 'product.variant_group_more_changes',
    params: { dimension: listFormat(locale, [...dimensions]) },
  };
}
