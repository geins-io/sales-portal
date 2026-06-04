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

  it('renders the product name as the first row with the variant value below', async () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: {},
        productName: 'Grenror 150/150',
      },
      global: { stubs: sheetStubs },
    });
    await wrapper.find('[data-testid="variant-trigger-Size"]').trigger('click');
    const firstItem = wrapper
      .find('[data-testid="variant-sheet-options"]')
      .findAll('li')[0]!;
    // First row is the product name (bold); the variant value is a row below.
    expect(firstItem.find('.font-medium').text()).toBe('Grenror 150/150');
    expect(firstItem.text()).toContain('S');
  });

  it('renders the variant sheet at the Figma 670px width', () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: {},
      },
      global: {
        stubs: {
          ...sheetStubs,
          SheetContent: {
            template:
              '<div data-testid="variant-sheet" :class="$props.class"><slot /></div>',
            props: ['side', 'class'],
          },
        },
      },
    });
    expect(wrapper.find('[data-testid="variant-sheet"]').classes()).toContain(
      'sm:max-w-[670px]',
    );
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

// Sibling-variant products (Geins GraphQL shape): each variant is its own
// product with a distinct name + article number, resolved by the parent and
// passed down via `variantProducts` keyed by alias. SAL-270: every row must
// surface ITS OWN name + art-nr, not the active product's on every row.
describe('VariantSelector per-variant name and article number', () => {
  // One variantDimensions row (the active product's own value) + the full
  // sibling set in variantGroup.variants, mirroring real Geins payloads.
  const siblingDimensions = [{ dimension: 'Variant', value: '88' }];
  const siblingVariants = [
    {
      alias: 'grenror-150-150-88',
      dimension: 'Variant',
      value: '88',
      stock: { totalStock: 5 },
    },
    {
      alias: 'grenror-100-100-90',
      dimension: 'Variant',
      value: '90',
      stock: { totalStock: 5 },
    },
    {
      alias: 'grenror-100-75-45',
      dimension: 'Variant',
      value: '75-45',
      stock: { totalStock: 5 },
    },
  ];
  // The active product (88) is intentionally absent: siblings are fetched
  // excluding self, so its row must fall back to the parent props.
  const variantProducts = {
    'grenror-100-100-90': {
      name: 'Grenrör 100/100-90',
      articleNumber: 'S1-233-090',
      priceFormatted: '950 kr',
    },
    'grenror-100-75-45': {
      name: 'Grenrör 100/75-45',
      articleNumber: 'S1-232-045',
      priceFormatted: '850 kr',
    },
  };

  // Interpolate product.article_number so the rendered art-nr value is
  // assertable (the default test $t returns the key verbatim).
  const interpolatingT = (key: string, params?: { number?: string }) =>
    key === 'product.article_number' && params?.number
      ? `Art nr. ${params.number}`
      : key;

  function openSiblingSheet() {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: siblingDimensions,
        variants: siblingVariants,
        modelValue: { Variant: '88' },
        productName: 'Grenrör 150/150-88',
        productArticleNumber: 'S1-243-088',
        variantProducts,
      },
      global: { stubs: sheetStubs, mocks: { $t: interpolatingT } },
    });
    return wrapper;
  }

  it('renders each sibling row with its OWN name, not the active product name', async () => {
    const wrapper = openSiblingSheet();
    await wrapper
      .find('[data-testid="variant-trigger-Variant"]')
      .trigger('click');
    const items = wrapper
      .find('[data-testid="variant-sheet-options"]')
      .findAll('li');
    // Order: variantDimensions value first (88), then sibling values (90, 75-45).
    const names = items.map((li) => li.find('.font-medium').text());
    expect(names).toEqual([
      'Grenrör 150/150-88', // active product (unmapped), parent fallback
      'Grenrör 100/100-90', // sibling, its own name
      'Grenrör 100/75-45', // sibling, its own name
    ]);
    // The bug was every row sharing one name; guard that they differ.
    expect(new Set(names).size).toBe(3);
  });

  it('renders each sibling row with its OWN article number', async () => {
    const wrapper = openSiblingSheet();
    await wrapper
      .find('[data-testid="variant-trigger-Variant"]')
      .trigger('click');
    const items = wrapper
      .find('[data-testid="variant-sheet-options"]')
      .findAll('li');
    expect(items[0]!.text()).toContain('Art nr. S1-243-088'); // active, parent
    expect(items[1]!.text()).toContain('Art nr. S1-233-090'); // sibling 90
    expect(items[2]!.text()).toContain('Art nr. S1-232-045'); // sibling 75-45
    // No row should mirror the active product's art-nr onto a sibling.
    expect(items[1]!.text()).not.toContain('S1-243-088');
    expect(items[2]!.text()).not.toContain('S1-243-088');
  });
});
