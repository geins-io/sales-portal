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

const sheetStubs = {
  Sheet: { template: '<div><slot /></div>', props: ['open'] },
  SheetContent: {
    template: '<div data-testid="variant-sheet"><slot /></div>',
    props: ['side', 'class'],
  },
  SheetHeader: { template: '<div><slot /></div>' },
  SheetTitle: { template: '<h2><slot /></h2>' },
};

describe('VariantSelector', () => {
  it('renders a trigger per dimension', () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: {},
      },
      global: { stubs: sheetStubs },
    });
    expect(wrapper.find('[data-testid="variant-trigger-Color"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="variant-trigger-Size"]').exists()).toBe(
      true,
    );
  });

  it('shows selected value in trigger when set', () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: { Color: 'Red' },
      },
      global: { stubs: sheetStubs },
    });
    const trigger = wrapper.find('[data-testid="variant-trigger-Color"]');
    expect(trigger.text()).toContain('Red');
  });

  it('opens sheet with dimension values when trigger clicked', async () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: {},
      },
      global: { stubs: sheetStubs },
    });
    await wrapper.find('[data-testid="variant-trigger-Size"]').trigger('click');
    const options = wrapper.find('[data-testid="variant-sheet-options"]');
    expect(options.exists()).toBe(true);
    expect(options.text()).toContain('S');
    expect(options.text()).toContain('M');
    expect(options.text()).toContain('L');
  });

  it('emits update:modelValue when value selected in sheet', async () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: {},
      },
      global: { stubs: sheetStubs },
    });
    await wrapper
      .find('[data-testid="variant-trigger-Color"]')
      .trigger('click');
    const valueButtons = wrapper
      .find('[data-testid="variant-sheet-options"]')
      .findAll('button');
    await valueButtons[0]!.trigger('click');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toEqual({ Color: 'Red' });
  });

  it('disables unavailable values based on current selection', async () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: { Color: 'Red' },
      },
      global: { stubs: sheetStubs },
    });
    await wrapper.find('[data-testid="variant-trigger-Size"]').trigger('click');
    const options = wrapper.find('[data-testid="variant-sheet-options"]');
    const buttons = options.findAll('button');
    // S available with Red (totalStock=5), M not (totalStock=0), L not (Blue/L only)
    expect(buttons[0]!.attributes('disabled')).toBeUndefined();
    expect(buttons[1]!.attributes('disabled')).toBeDefined();
    expect(buttons[2]!.attributes('disabled')).toBeDefined();
  });
});
