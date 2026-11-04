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

  const textProps = {
    imageFileName: null,
    imageAlt: '',
    title: 'Widget',
    subtitle: 'Size 44',
    showStock: false,
    inStock: true,
    selected: false,
  };

  it('shows the no-image icon, named for screen readers, for a variant without an image', () => {
    const wrapper = mountComponent(VariantSheetRow, {
      props: { ...textProps, imageMissing: true },
    });

    const placeholder = wrapper.find('[data-testid="variant-row-no-image"]');
    expect(placeholder.exists()).toBe(true);
    expect(placeholder.attributes('role')).toBe('img');
    expect(placeholder.attributes('aria-label')).toBe('product.no_image');
    expect(wrapper.find('img').exists()).toBe(false);
  });

  it('leaves the thumbnail box empty while the image is not known yet', () => {
    const wrapper = mountComponent(VariantSheetRow, { props: textProps });

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('[data-testid="variant-row-no-image"]').exists()).toBe(
      false,
    );
  });

  it('shows a hint in place of the stock line', () => {
    const wrapper = mountComponent(VariantSheetRow, {
      props: { ...textProps, showStock: true, hint: 'Gänga: M6 · M8' },
    });

    expect(wrapper.find('[data-testid="variant-row-hint"]').text()).toBe(
      'Gänga: M6 · M8',
    );
    expect(wrapper.text()).not.toContain('product.in_stock');
  });

  it('leaves out an empty subtitle', () => {
    const wrapper = mountComponent(VariantSheetRow, {
      props: { ...textProps, subtitle: '' },
    });

    expect(wrapper.findAll('.text-muted-foreground.text-sm')).toHaveLength(0);
  });

  it('drops the thumbnail for a chevron at the right edge on a row that opens a sheet', () => {
    const wrapper = mountComponent(VariantSheetRow, {
      props: { ...textProps, imageFileName: 'widget.jpg', opensSheet: true },
    });

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.bg-muted.size-12').exists()).toBe(false);
    const chevron = wrapper.find('[data-testid="variant-row-chevron"]');
    expect(chevron.exists()).toBe(true);
    expect(chevron.classes()).toEqual(
      expect.arrayContaining(['text-muted-foreground', 'size-5', 'shrink-0']),
    );
  });

  it('leaves aria-pressed off a row that opens a sheet and hides its chevron', () => {
    const opens = mountComponent(VariantSheetRow, {
      props: { ...textProps, opensSheet: true },
    });
    const plain = mountComponent(VariantSheetRow, { props: textProps });

    expect(opens.find('button').attributes('aria-pressed')).toBeUndefined();
    expect(
      opens
        .find('[data-testid="variant-row-chevron"]')
        .attributes('aria-hidden'),
    ).toBe('true');
    expect(plain.find('button').attributes('aria-pressed')).toBe('false');
  });
});
