/**
 * Options for building a product image alt text.
 *
 * Rules, applied in order:
 *   1. decorative === true -> return '' (empty; screen readers skip the image).
 *   2. manualAlt is a non-empty string after trim -> return manualAlt verbatim
 *      (the original, untrimmed value; trim is only the emptiness guard).
 *   3. (total ?? 1) <= 1 -> return name alone (single image, no counter).
 *   4. Otherwise -> return localized counter via product.image_alt_counter.
 */
export interface ProductImageAltOptions {
  /** The product name used as the base alt text. */
  name: string;
  /** Zero-based image index; defaults to 0 when omitted. */
  index?: number;
  /** Total number of images; omit or pass 1 for a single-image product. */
  total?: number;
  /**
   * Native Geins altText override. When non-empty after trimming it is
   * returned verbatim and takes priority over the counter. Whitespace-only,
   * null, and undefined are treated as absent.
   */
  manualAlt?: string | null;
  /**
   * Set to true for purely decorative images. Returns an empty string so
   * screen readers skip the element. Wins over every other option.
   */
  decorative?: boolean;
}

/**
 * Composable that provides a single, canonical builder for PDP image alt text.
 * Uses useI18n() for the localized multi-image counter.
 */
export function useProductImageAlt() {
  const { t } = useI18n();

  function buildProductImageAlt(opts: ProductImageAltOptions): string {
    const { name, index, total, manualAlt, decorative } = opts;

    // Rule 1: decorative image, screen readers ignore it.
    if (decorative === true) {
      return '';
    }

    // Rule 2: non-empty manualAlt returned verbatim (untrimmed).
    if (typeof manualAlt === 'string' && manualAlt.trim() !== '') {
      return manualAlt;
    }

    // Rule 3: single image, return name with no counter.
    if ((total ?? 1) <= 1) {
      return name;
    }

    // Rule 4: multi-image counter, localized.
    return t('product.image_alt_counter', {
      name,
      current: (index ?? 0) + 1,
      total,
    });
  }

  return { buildProductImageAlt };
}
