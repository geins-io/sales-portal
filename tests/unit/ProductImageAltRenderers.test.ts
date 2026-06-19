import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Source-level guard: every PDP product-image renderer must derive its :alt
 * from buildProductImageAlt (from useProductImageAlt). No renderer may
 * compute a product-image alt inline. Mirrors the ButtonsWidget style.
 */
describe('PDP image-alt renderer source guard', () => {
  const gallery = readFileSync(
    resolve(__dirname, '../../app/components/product/ProductGallery.vue'),
    'utf-8',
  );
  const variantSelector = readFileSync(
    resolve(__dirname, '../../app/components/product/VariantSelector.vue'),
    'utf-8',
  );
  const productDetails = readFileSync(
    resolve(__dirname, '../../app/components/pages/ProductDetails.vue'),
    'utf-8',
  );

  describe('ProductGallery.vue', () => {
    it('references useProductImageAlt', () => {
      expect(gallery).toContain('useProductImageAlt');
    });

    it('references buildProductImageAlt', () => {
      expect(gallery).toContain('buildProductImageAlt');
    });

    it('does not contain the hand-rolled altForIndex function', () => {
      expect(gallery).not.toContain('function altForIndex');
    });

    it('does not resolve the counter inline via the i18n key', () => {
      expect(gallery).not.toContain('image_alt_counter');
    });
  });

  describe('VariantSelector.vue', () => {
    it('references buildProductImageAlt', () => {
      expect(variantSelector).toContain('buildProductImageAlt');
    });

    it('does not bind :alt inline as productName ?? value', () => {
      expect(variantSelector).not.toMatch(/:alt="productName \?\? value"/);
    });
  });

  describe('ProductDetails.vue', () => {
    it('references buildProductImageAlt', () => {
      expect(productDetails).toContain('buildProductImageAlt');
    });

    it('does not bind :alt inline as product.name', () => {
      expect(productDetails).not.toMatch(/:alt="product\.name \?\? ''"/);
    });
  });
});
