import type { ProductImageType } from '#shared/types/commerce';

/**
 * The product's primary image: the one flagged `isPrimary`, else the first.
 * The print data sheet shows it at the top and leaves it out of the extra
 * images, so both must ask this one question. The storefront schema has no
 * `isPrimary` today, so in practice it is the first image.
 */
export function primaryProductImage<
  T extends Pick<ProductImageType, 'isPrimary'>,
>(images: readonly T[]): T | undefined {
  return images.find((i) => i.isPrimary) ?? images[0];
}
