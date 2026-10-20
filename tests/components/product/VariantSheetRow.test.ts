import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import { requestedShapes } from '../../utils/image';
import VariantSheetRow from '../../../app/components/product/VariantSheetRow.vue';

describe('VariantSheetRow', () => {
  it('asks the CDN for the square its 48 px thumbnail box shows', () => {
    const img = mountComponent(VariantSheetRow, {
      props: {
        imageFileName: 'widget.jpg',
        imageUrl: 'https://cdn.example.test/acme/products/widget.jpg',
        imageAlt: 'Widget',
        title: 'Widget',
        subtitle: 'Size 44',
        showStock: false,
        inStock: true,
        selected: false,
      },
    }).find('img');

    const shapes = requestedShapes(img.attributes('srcset'));
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes.every((s) => s.ratio === 1 && s.fit === 'crop')).toBe(true);
  });
});
