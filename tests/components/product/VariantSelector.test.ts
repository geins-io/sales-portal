import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import VariantSelector from '../../../app/components/product/VariantSelector.vue';

const dimensions = [
  { dimensionName: 'Color', values: ['Red', 'Blue'] },
  { dimensionName: 'Size', values: ['S', 'M', 'L'] },
];

const variants = [
  {
    variantId: 1,
    attributes: [
      { attributeName: 'Color', attributeValue: 'Red' },
      { attributeName: 'Size', attributeValue: 'S' },
    ],
    price: { sellingPriceIncVat: 100, isDiscounted: false },
    stock: { inStock: 5, oversellable: 0, totalStock: 5, static: 0 },
  },
  {
    variantId: 2,
    attributes: [
      { attributeName: 'Color', attributeValue: 'Red' },
      { attributeName: 'Size', attributeValue: 'M' },
    ],
    price: { sellingPriceIncVat: 100, isDiscounted: false },
    stock: { inStock: 0, oversellable: 0, totalStock: 0, static: 0 },
  },
  {
    variantId: 3,
    attributes: [
      { attributeName: 'Color', attributeValue: 'Blue' },
      { attributeName: 'Size', attributeValue: 'L' },
    ],
    price: { sellingPriceIncVat: 120, isDiscounted: false },
    stock: { inStock: 3, oversellable: 0, totalStock: 3, static: 0 },
  },
];

describe('VariantSelector', () => {
  it('renders dimension groups', () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: {},
      },
    });
    expect(wrapper.text()).toContain('Color');
    expect(wrapper.text()).toContain('Size');
  });

  it('renders value buttons', () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: {},
      },
    });
    const buttons = wrapper.findAll('[data-testid="dimension-values"] button');
    // 2 colors + 3 sizes = 5 buttons
    expect(buttons.length).toBe(5);
    expect(buttons[0]!.text()).toBe('Red');
    expect(buttons[1]!.text()).toBe('Blue');
    expect(buttons[2]!.text()).toBe('S');
  });

  it('emits update on click', async () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: {},
      },
    });
    const buttons = wrapper.findAll('[data-testid="dimension-values"] button');
    await buttons[0]!.trigger('click');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toEqual({ Color: 'Red' });
  });
});
