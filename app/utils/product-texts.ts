import type { ProductTextsType } from '@geins/types';

/**
 * TEMPORARY SHIM — delete once Geins realigns its product text fields.
 *
 * The Geins PIM labels a product's rich-text boxes "Text 1", "Text 2" and
 * "Text 3", but the Merchant API returns them cyclically offset. The mapping
 * below is what we observed against live data, not an assumption: the demo
 * content is self-labelled, e.g. the field returned as `text1` literally
 * begins "Text 2 ...", `text2` begins "Text 3 ...", `text3` begins "Text 1 ...".
 *
 * It is expressed as a config map (data), not baked into the lookup, so the
 * day the offset is fixed you swap {@link GEINS_ADMIN_TEXT_FIELD_MAP} for
 * {@link IDENTITY_ADMIN_TEXT_FIELD_MAP} (or delete this file) and every caller
 * follows from one place.
 */
export type ProductTextField = 'text1' | 'text2' | 'text3';

/** The number shown on a PIM "Text N" box. */
export type AdminTextBox = 1 | 2 | 3;

/** Maps each PIM "Text N" box onto the API field that actually holds it. */
export type AdminTextFieldMap = Readonly<Record<AdminTextBox, ProductTextField>>;

/** Observed Geins offset (PIM box -> Merchant API field). */
export const GEINS_ADMIN_TEXT_FIELD_MAP: AdminTextFieldMap = {
  1: 'text3',
  2: 'text1',
  3: 'text2',
};

/** What the map becomes the day Geins aligns box N with `textN`. */
export const IDENTITY_ADMIN_TEXT_FIELD_MAP: AdminTextFieldMap = {
  1: 'text1',
  2: 'text2',
  3: 'text3',
};

/**
 * Returns the HTML a merchant entered in the PIM "Text {box}" field, resolving
 * the box number through {@link map} (defaults to the observed Geins offset).
 * `box` is the number shown in the PIM, not the raw API field index. A missing
 * or null field is normalised to `undefined`.
 */
export function adminText(
  texts: ProductTextsType | null | undefined,
  box: AdminTextBox,
  map: AdminTextFieldMap = GEINS_ADMIN_TEXT_FIELD_MAP,
): string | undefined {
  return texts?.[map[box]] ?? undefined;
}
