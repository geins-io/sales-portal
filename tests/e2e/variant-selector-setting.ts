import { expect, type Page } from './fixtures';
import { outOfScope } from './helpers';
import { apiGet } from './api-call';

/**
 * The store setting PDP variant selection style, as `/api/config` serves it.
 * A spec runs the tests for the style the target has saved; switching the
 * setting in Studio switches which ones run. Every style is covered at unit
 * level.
 */
export interface VariantSelectorStyle {
  display: 'panel' | 'dropdown';
  grouping: 'dimension' | 'none';
}

export async function savedVariantSelector(
  page: Page,
): Promise<VariantSelectorStyle> {
  const response = await apiGet(page.request, '/api/config');
  expect(response.ok(), '/api/config did not answer 200').toBe(true);
  const saved = (await response.json())?.layout?.variantSelector as
    { display?: string | null; grouping?: string | null } | null | undefined;
  return {
    display: saved?.display === 'dropdown' ? 'dropdown' : 'panel',
    grouping: saved?.grouping === 'none' ? 'none' : 'dimension',
  };
}

/** Out of scope unless the store has saved this display (and grouping). */
export async function onlyForVariantSelector(
  page: Page,
  display: VariantSelectorStyle['display'],
  grouping?: VariantSelectorStyle['grouping'],
) {
  const saved = await savedVariantSelector(page);
  outOfScope(
    saved.display !== display ||
      (grouping !== undefined && saved.grouping !== grouping),
    'tenant-config',
    `the store's variant selector is ${saved.display}, grouped by ${saved.grouping}`,
  );
}
