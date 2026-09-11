import { describe, it, expect, beforeEach } from 'vitest';
import type { VariantDimensionType, VariantType } from '@geins/types';
import { nextTick } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { mountComponent } from '../../utils/component';
import VariantSelector from '../../../app/components/product/VariantSelector.vue';
import { mockShowIncVat } from '../../setup-components';

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

// The VAT-display ref is anchored on globalThis and vitest runs without
// isolation, so a value left behind here reaches every other spec.
beforeEach(() => {
  mockShowIncVat.value = true;
});

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

  it('prevents the sheet from auto-focusing on open so the mobile keyboard stays hidden', () => {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: dimensions,
        variants,
        modelValue: {},
      },
      global: { stubs: sheetStubs },
    });

    // The variant-search input is the first focusable element in the sheet;
    // letting reka-ui auto-focus it on open would pop the soft keyboard and
    // hide the variant options, so the component must preventDefault.
    const sheet = wrapper.findComponent<ComponentPublicInstance>(
      '[data-testid="variant-sheet"]',
    );
    const event = new Event('focus', { cancelable: true });
    sheet.vm.$emit('openAutoFocus', event);
    expect(event.defaultPrevented).toBe(true);
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

  it('disables only invalid combinations, not out-of-stock values', async () => {
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
    // With Color=Red: S is a real combo in stock (totalStock=5) -> selectable.
    // M is a real combo but out of stock (totalStock=0) -> still SELECTABLE,
    // since an out-of-stock variant stays viewable. L only exists as Blue/L,
    // so Red+L is an invalid combination -> disabled.
    expect(buttons[0]!.attributes('disabled')).toBeUndefined();
    expect(buttons[1]!.attributes('disabled')).toBeUndefined();
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
  // The component declares `VariantDimensionType[]`/`VariantType[]` but casts
  // both props to the GraphQL row shape in its own setup, and its comment says
  // it tolerates that shape deliberately. These fixtures carry what the API
  // really sends, so the cast below is the point of the test; the declared prop
  // type is the thing that is wrong, and that is product code.
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
      priceIncVatFormatted: '950 kr',
      priceExVatFormatted: '760 kr',
    },
    'grenror-100-75-45': {
      name: 'Grenrör 100/75-45',
      articleNumber: 'S1-232-045',
      priceIncVatFormatted: '850 kr',
      priceExVatFormatted: '680 kr',
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
        variantDimensions:
          siblingDimensions as unknown as VariantDimensionType[],
        variants: siblingVariants as unknown as VariantType[],
        modelValue: { Variant: '88' },
        productName: 'Grenrör 150/150-88',
        productArticleNumber: 'S1-243-088',
        priceIncVatFormatted: '1 200 kr',
        priceExVatFormatted: '960 kr',
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

  // SAL-270 kickback: a sibling group where every variant is out of stock
  // (Geins returns attributes:null + stock.totalStock:0, as the cable-gland
  // products on elproman do) must NOT render every row disabled. Out-of-stock
  // siblings are still real, viewable products and must stay selectable.
  it('keeps out-of-stock sibling variants selectable, not disabled', async () => {
    const oosDimensions = [{ dimension: 'Variant', value: 'm 20 / 5-8' }];
    const oosVariants = [
      {
        alias: 'gland-m20',
        dimension: 'Variant',
        value: 'm 20 / 5-8',
        attributes: null,
        stock: { totalStock: 0 },
      },
      {
        alias: 'gland-m32',
        dimension: 'Variant',
        value: 'm 32 / 11,5-15,5',
        attributes: null,
        stock: { totalStock: 0 },
      },
    ];
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: oosDimensions as unknown as VariantDimensionType[],
        variants: oosVariants as unknown as VariantType[],
        modelValue: { Variant: 'm 20 / 5-8' },
        productName: 'Metallförskruvning M20x1,5',
      },
      global: { stubs: sheetStubs },
    });
    await wrapper
      .find('[data-testid="variant-trigger-Variant"]')
      .trigger('click');
    const buttons = wrapper
      .find('[data-testid="variant-sheet-options"]')
      .findAll('button');
    expect(buttons.length).toBe(2);
    for (const button of buttons) {
      expect(button.attributes('disabled')).toBeUndefined();
      expect(button.classes()).not.toContain('opacity-40');
    }
  });
});

// The variant rows carry their own price, and that price must answer to the
// inc/ex VAT switcher exactly as the main price on the same page does. The
// active product's own row (88) is served by the parent fallback props, the
// other two by their entries in variantProducts, so both sources are covered.
describe('VariantSelector row price follows the VAT preference', () => {
  const siblingDimensions = [{ dimension: 'Variant', value: '88' }];
  const siblingVariants = [
    { alias: 'grenror-150-150-88', dimension: 'Variant', value: '88' },
    { alias: 'grenror-100-100-90', dimension: 'Variant', value: '90' },
    { alias: 'grenror-100-75-45', dimension: 'Variant', value: '75-45' },
  ];
  const variantProducts = {
    'grenror-100-100-90': {
      name: 'Grenrör 100/100-90',
      articleNumber: 'S1-233-090',
      priceIncVatFormatted: '950 kr',
      priceExVatFormatted: '760 kr',
    },
    'grenror-100-75-45': {
      name: 'Grenrör 100/75-45',
      articleNumber: 'S1-232-045',
      priceIncVatFormatted: '850 kr',
      priceExVatFormatted: '680 kr',
    },
  };

  async function openPriceSheet() {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions:
          siblingDimensions as unknown as VariantDimensionType[],
        variants: siblingVariants as unknown as VariantType[],
        modelValue: { Variant: '88' },
        productName: 'Grenrör 150/150-88',
        productArticleNumber: 'S1-243-088',
        priceIncVatFormatted: '1 200 kr',
        priceExVatFormatted: '960 kr',
        variantProducts,
      },
      global: { stubs: sheetStubs },
    });
    await wrapper
      .find('[data-testid="variant-trigger-Variant"]')
      .trigger('click');
    return wrapper;
  }

  function rowPrices(wrapper: ReturnType<typeof mountComponent>): string[] {
    return wrapper
      .findAll('[data-testid="variant-row-price"]')
      .map((el) => el.text());
  }

  it('shows inc-VAT row prices when the buyer prefers inc VAT', async () => {
    mockShowIncVat.value = true;
    const wrapper = await openPriceSheet();
    // Order: the active product's own value first, then the siblings.
    expect(rowPrices(wrapper)).toEqual(['1 200 kr', '950 kr', '850 kr']);
  });

  it('shows ex-VAT row prices when the buyer prefers ex VAT', async () => {
    mockShowIncVat.value = false;
    const wrapper = await openPriceSheet();
    expect(rowPrices(wrapper)).toEqual(['960 kr', '760 kr', '680 kr']);
  });

  it('re-renders the row prices when the preference changes, without a remount', async () => {
    mockShowIncVat.value = true;
    const wrapper = await openPriceSheet();
    expect(rowPrices(wrapper)).toEqual(['1 200 kr', '950 kr', '850 kr']);

    mockShowIncVat.value = false;
    await nextTick();

    expect(rowPrices(wrapper)).toEqual(['960 kr', '760 kr', '680 kr']);
  });
});
