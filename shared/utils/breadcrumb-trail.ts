import type { BreadcrumbItem } from '../types/common';
import { categoryPath } from './route-helpers';

/** A resolved ancestor category, as the breadcrumb needs it. */
export interface CategoryAncestor {
  name: string;
  canonicalUrl: string;
}

/**
 * Map a resolved chain to breadcrumb items.
 *
 * Every href goes through `categoryPath()`: Geins emits `canonicalUrl` in three
 * shapes in production — with `/c/`, with `/l/`, and with neither.
 */
export function ancestorCrumbs(
  ancestors: readonly CategoryAncestor[] | null | undefined,
  localize: (path: string) => string,
): BreadcrumbItem[] {
  return (ancestors ?? []).map((a) => ({
    label: a.name,
    href: localize(categoryPath(a.canonicalUrl)),
  }));
}

/** A category as the product payload carries it, in `product.categories`. */
export interface CategoryNode {
  categoryId?: number | null;
  parentCategoryId?: number | null;
  name?: string | null;
  canonicalUrl?: string | null;
}

/**
 * Ancestors of the primary category, root first.
 *
 * The trail follows the PRIMARY category's path, never the one the visitor
 * navigated in from. Indexed by id and walked up `parentCategoryId`, never read
 * positionally: the source array is the closure of every assigned category plus
 * their ancestors, and its order differs between tenants (sonoralab root-first,
 * tenant-a leaf-first).
 *
 * Returns an EMPTY chain the moment the walk cannot continue — a missing
 * parent, a non-number parent, an entry without name or canonicalUrl, a cycle.
 * A trail with a gap is indistinguishable from the truncated trail this
 * replaced, so a partial result is never returned. Only `0` ends the walk:
 * `parentCategoryId` is a non-optional `number` in `@geins/types` and roots
 * report 0 on all five tenants measured, so anything else is not a root.
 */
export function ancestorsFromCategories(
  categories: readonly (CategoryNode | null | undefined)[] | null | undefined,
  primaryCategoryId: number | null | undefined,
): CategoryAncestor[] {
  if (typeof primaryCategoryId !== 'number') return [];

  const byId = new Map<number, CategoryNode>();
  for (const node of categories ?? []) {
    if (node && typeof node.categoryId === 'number') {
      byId.set(node.categoryId, node);
    }
  }

  let current = byId.get(primaryCategoryId);
  if (!current) return [];

  const chain: CategoryAncestor[] = [];
  const seen = new Set<number>([primaryCategoryId]);

  while (current.parentCategoryId !== 0) {
    const parentId = current.parentCategoryId;
    if (typeof parentId !== 'number') return [];
    if (seen.has(parentId)) return [];
    const parent = byId.get(parentId);
    if (!parent?.name || !parent.canonicalUrl) return [];
    seen.add(parentId);
    chain.push({ name: parent.name, canonicalUrl: parent.canonicalUrl });
    current = parent;
  }

  return chain.reverse();
}
