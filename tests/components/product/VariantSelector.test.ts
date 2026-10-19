import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { mountComponent } from '../../utils/component';
import VariantSelector from '../../../app/components/product/VariantSelector.vue';
import { mockShowIncVat } from '../../setup-components';
import type {
  StockType,
  VariantDimensionRow,
  VariantNode,
} from '#shared/types/commerce';
import type { SkuType } from '@geins/types';
import { variantCombinations } from '../../../app/utils/variant-tree';
import { twoDimensionTree } from '../../fixtures/variant-trees';

const stock = (totalStock: number): StockType => ({
  inStock: totalStock,
  oversellable: 0,
  totalStock,
  static: 0,
});

// One row per (dimension, value) pair, as the query returns them.
const row = (dimension: string, value: string): VariantDimensionRow => ({
  dimension,
  value,
  label: value,
  level: 0,
});

const dimensions = [
  row('Color', 'Red'),
  row('Color', 'Blue'),
  row('Size', 'S'),
  row('Size', 'M'),
  row('Size', 'L'),
];

// No node carries an alias, so there is no tree and the selector falls back to
// the dimension rows and each variant's `{ key, value }` attributes.
const variants: VariantNode[] = [
  {
    skuId: 1,
    attributes: [
      { key: 'Color', value: 'Red' },
      { key: 'Size', value: 'S' },
    ],
    stock: stock(5),
  },
  {
    skuId: 2,
    attributes: [
      { key: 'Color', value: 'Red' },
      { key: 'Size', value: 'M' },
    ],
    stock: stock(0),
  },
  {
    skuId: 3,
    attributes: [
      { key: 'Color', value: 'Blue' },
      { key: 'Size', value: 'L' },
    ],
    stock: stock(3),
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
  const siblingDimensions = [row('Variant', '88')];
  const siblingVariants: VariantNode[] = [
    {
      alias: 'grenror-150-150-88',
      dimension: 'Variant',
      value: '88',
      stock: stock(5),
    },
    {
      alias: 'grenror-100-100-90',
      dimension: 'Variant',
      value: '90',
      stock: stock(5),
    },
    {
      alias: 'grenror-100-75-45',
      dimension: 'Variant',
      value: '75-45',
      stock: stock(5),
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

  function openSiblingSheet(withTree = false) {
    const wrapper = mountComponent(VariantSelector, {
      props: {
        ...(withTree
          ? { combinations: variantCombinations(siblingVariants) }
          : {}),
        variantDimensions: siblingDimensions,
        variants: siblingVariants,
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

  // The page always passes the flattened tree; one dimension must render the
  // same rows through it as through the legacy props above.
  it('renders the same sibling rows through the tree the page passes', async () => {
    const wrapper = openSiblingSheet(true);
    await wrapper
      .find('[data-testid="variant-trigger-Variant"]')
      .trigger('click');
    const items = wrapper
      .find('[data-testid="variant-sheet-options"]')
      .findAll('li');
    expect(items.map((li) => li.find('.font-medium').text())).toEqual([
      'Grenrör 150/150-88',
      'Grenrör 100/100-90',
      'Grenrör 100/75-45',
    ]);
    expect(items[0]!.text()).toContain('Art nr. S1-243-088');
    expect(items[1]!.text()).toContain('Art nr. S1-233-090');
    expect(items[2]!.text()).toContain('Art nr. S1-232-045');
    expect(
      items.map((li) => li.find('[data-testid="variant-row-price"]').text()),
    ).toEqual(['1 200 kr', '950 kr', '850 kr']);
    expect(items.every((li) => !li.find('button').attributes('disabled'))).toBe(
      true,
    );
  });

  // SAL-270 kickback: a sibling group where every variant is out of stock
  // (Geins returns attributes:null + stock.totalStock:0, as the cable-gland
  // products on elproman do) must NOT render every row disabled. Out-of-stock
  // siblings are still real, viewable products and must stay selectable.
  it('keeps out-of-stock sibling variants selectable, not disabled', async () => {
    const oosDimensions = [row('Variant', 'm 20 / 5-8')];
    const oosVariants: VariantNode[] = [
      {
        alias: 'gland-m20',
        dimension: 'Variant',
        value: 'm 20 / 5-8',
        attributes: null,
        stock: stock(0),
      },
      {
        alias: 'gland-m32',
        dimension: 'Variant',
        value: 'm 32 / 11,5-15,5',
        attributes: null,
        stock: stock(0),
      },
    ];
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: oosDimensions,
        variants: oosVariants,
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
  const siblingDimensions = [row('Variant', '88')];
  const siblingVariants: VariantNode[] = [
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
        variantDimensions: siblingDimensions,
        variants: siblingVariants,
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

// The legacy path put the current product's own value first, so the list
// reshuffled from one sibling page to the next. Through the tree the order is
// the payload's, the same on every sibling page.
describe('VariantSelector value order on one dimension', () => {
  it('lists values in tree order even when the current product is not first', async () => {
    const node = (value: string) => ({
      alias: `glidlager-brons-${value.replace(' ', '-')}`,
      dimension: 'Dimension',
      value,
      label: value,
      level: 1,
    });
    const tree: VariantNode[] = [node('20 mm'), node('25 mm'), node('30 mm')];
    const wrapper = mountComponent(VariantSelector, {
      props: {
        variantDimensions: [row('Dimension', '25 mm')],
        variants: tree,
        combinations: variantCombinations(tree),
        modelValue: { Dimension: '25 mm' },
      },
      global: { stubs: sheetStubs },
    });
    await wrapper
      .find('[data-testid="variant-trigger-Dimension"]')
      .trigger('click');

    const values = wrapper
      .findAll('[data-testid="variant-option"]')
      .map((b) => b.attributes('data-value'));
    expect(values).toEqual(['20 mm', '25 mm', '30 mm']);
  });
});

describe('VariantSelector on a two-dimension variant tree', () => {
  const combinations = variantCombinations(twoDimensionTree);

  function mountTree(modelValue: Record<string, string>) {
    return mountComponent(VariantSelector, {
      props: {
        variantDimensions: [],
        variants: [],
        combinations,
        modelValue,
        productName: 'Sexkantskruv M12x60',
        variantProducts: {
          'sexkantskruv-m10x50-din-933-rostfri-a2': {
            name: 'Sexkantskruv M10x50',
          },
          'sexkantskruv-m8x40-din-933-rostfri-a2': {
            name: 'Sexkantskruv M8x40',
          },
        },
      },
      global: { stubs: sheetStubs },
    });
  }

  it('shows the current variant by label on both triggers', () => {
    const wrapper = mountTree({ Gänga: 'm12', Längd: '60 mm' });

    expect(wrapper.find('[data-testid="variant-trigger-Gänga"]').text()).toBe(
      'M12',
    );
    expect(wrapper.find('[data-testid="variant-trigger-Längd"]').text()).toBe(
      '60 mm',
    );
  });

  it('lists the second dimension across every top node', async () => {
    const wrapper = mountTree({ Gänga: 'm12', Längd: '60 mm' });
    await wrapper
      .find('[data-testid="variant-trigger-Längd"]')
      .trigger('click');

    const rows = wrapper
      .find('[data-testid="variant-sheet-options"]')
      .findAll('li');
    expect(
      rows.map((li) => li.find('.text-sm.text-muted-foreground').text()),
    ).toEqual(['50 mm', '60 mm', '40 mm']);
    expect(rows.map((li) => li.find('.font-medium').text())).toEqual([
      'Sexkantskruv M10x50',
      'Sexkantskruv M12x60',
      'Sexkantskruv M8x40',
    ]);
  });

  it('shows labels in the sheet and emits the value', async () => {
    const wrapper = mountTree({ Gänga: 'm12', Längd: '60 mm' });
    await wrapper
      .find('[data-testid="variant-trigger-Gänga"]')
      .trigger('click');

    const rows = wrapper
      .find('[data-testid="variant-sheet-options"]')
      .findAll('li');
    expect(rows[0]!.text()).toContain('M10');
    await rows[0]!.find('button').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      { Gänga: 'm10', Längd: '60 mm' },
    ]);
  });

  it('searches on the label', async () => {
    const wrapper = mountTree({ Gänga: 'm12', Längd: '60 mm' });
    await wrapper
      .find('[data-testid="variant-trigger-Gänga"]')
      .trigger('click');
    await wrapper.find('[data-testid="variant-sheet-search"]').setValue('M8');

    const rows = wrapper
      .find('[data-testid="variant-sheet-options"]')
      .findAll('li');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.find('.font-medium').text()).toBe('Sexkantskruv M8x40');
  });
});

// A product sold in several SKUs of its own, shaped as the API sends it: one
// `DefaultProduct` dimension row and node, the choice only in `skus`.
describe('VariantSelector SKU choice', () => {
  const interpolatingT = (key: string, params?: { number?: string }) =>
    params?.number ? `Art nr. ${params.number}` : key;
  const ownDimension: VariantDimensionRow[] = [
    {
      dimension: 'DefaultProduct',
      value: 'skyddsglasögon klar en 166',
      label: 'Skyddsglasögon klar EN 166',
      level: 1,
    },
  ];
  const ownNode: VariantNode[] = [
    {
      alias: 'skyddsglasogon-klar-en-166',
      dimension: 'DefaultProduct',
      value: 'skyddsglasögon klar en 166',
      label: 'Skyddsglasögon klar EN 166',
      skuId: 0,
    },
  ];
  const skus: SkuType[] = [
    {
      skuId: 1099,
      name: 'Skyddsglasögon klar',
      articleNumber: 'SKY-GLAS-KLAR',
      stock: stock(284),
    },
    {
      skuId: 1113,
      name: 'S',
      articleNumber: 'SKY-GLAS-KLAR-S',
      stock: stock(5),
    },
    {
      skuId: 1114,
      name: 'M',
      articleNumber: 'SKY-GLAS-KLAR-M',
      stock: stock(0),
    },
  ];

  function mountSkuChoice(
    props: Record<string, unknown> = {},
  ): ReturnType<typeof mountComponent> {
    return mountComponent(VariantSelector, {
      props: {
        variantDimensions: ownDimension,
        variants: ownNode,
        modelValue: {},
        productName: 'Skyddsglasögon klar EN 166',
        productArticleNumber: 'SKY-GLAS-KLAR',
        priceIncVatFormatted: '112,50 kr',
        priceExVatFormatted: '90 kr',
        skuOptions: skus,
        skuId: null,
        ...props,
      },
      global: { stubs: sheetStubs, mocks: { $t: interpolatingT } },
    });
  }

  it('shows no DefaultProduct group, only the SKU group under the generic heading', () => {
    const wrapper = mountSkuChoice();

    expect(wrapper.text()).not.toContain('DefaultProduct');
    expect(
      wrapper.find('[data-testid="variant-trigger-DefaultProduct"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="variant-trigger-sku"]').text()).toBe(
      'product.select_variant_placeholder',
    );
    expect(wrapper.text()).toContain('product.variant_heading');
  });

  it('names the picked SKU on the trigger', () => {
    const wrapper = mountSkuChoice({ skuId: 1113 });

    expect(wrapper.find('[data-testid="variant-trigger-sku"]').text()).toBe(
      'S',
    );
  });

  it('lists every SKU with its own name, article number, stock and the product price', async () => {
    const wrapper = mountSkuChoice();
    await wrapper.find('[data-testid="variant-trigger-sku"]').trigger('click');

    const rows = wrapper.findAll('[data-testid="variant-option"]');
    expect(rows.map((r) => r.attributes('data-value'))).toEqual([
      '1099',
      '1113',
      '1114',
    ]);
    const m = rows[2]!;
    expect(m.find('.font-medium').text()).toBe('Skyddsglasögon klar EN 166');
    expect(m.text()).toContain('M');
    expect(m.text()).toContain('Art nr. SKY-GLAS-KLAR-M');
    expect(m.text()).toContain('product.out_of_stock');
    expect(rows[1]!.text()).toContain('product.in_stock');
    expect(m.find('[data-testid="variant-row-price"]').text()).toBe(
      '112,50 kr',
    );
    expect(m.attributes('disabled')).toBeUndefined();
    expect(wrapper.find('h2').text()).toBe(
      'product.select_variant — product.variant_heading',
    );
  });

  it('emits the picked skuId, never a dimension selection', async () => {
    const wrapper = mountSkuChoice();
    await wrapper.find('[data-testid="variant-trigger-sku"]').trigger('click');

    await wrapper.find('[data-value="1114"]').trigger('click');

    expect(wrapper.emitted('update:skuId')).toEqual([[1114]]);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('marks the picked SKU in the sheet', async () => {
    const wrapper = mountSkuChoice({ skuId: 1113 });
    await wrapper.find('[data-testid="variant-trigger-sku"]').trigger('click');

    const pressed = wrapper
      .findAll('[data-testid="variant-option"]')
      .map((r) => r.attributes('aria-pressed'));
    expect(pressed).toEqual(['false', 'true', 'false']);
  });

  it('searches the SKUs on name and article number', async () => {
    const wrapper = mountSkuChoice();
    await wrapper.find('[data-testid="variant-trigger-sku"]').trigger('click');

    await wrapper
      .find('[data-testid="variant-sheet-search"]')
      .setValue('klar-s');
    expect(
      wrapper
        .findAll('[data-testid="variant-option"]')
        .map((r) => r.attributes('data-value')),
    ).toEqual(['1113']);

    await wrapper.find('[data-testid="variant-sheet-search"]').setValue('m');
    expect(
      wrapper
        .findAll('[data-testid="variant-option"]')
        .map((r) => r.attributes('data-value')),
    ).toEqual(['1114']);
  });

  it('opens the SKU sheet when the page asks for it', async () => {
    const wrapper = mountSkuChoice();
    expect(wrapper.find('[data-testid="variant-sheet-options"]').exists()).toBe(
      false,
    );

    (wrapper.vm as unknown as { openSkuSheet: () => void }).openSkuSheet();
    await nextTick();

    expect(
      wrapper.findAll('[data-testid="variant-option"]').map((r) => r.text()),
    ).toHaveLength(3);
  });

  it('renders no SKU group for a single SKU', () => {
    const wrapper = mountSkuChoice({ skuOptions: skus.slice(0, 1) });

    expect(wrapper.find('[data-testid="variant-trigger-sku"]').exists()).toBe(
      false,
    );
  });

  it('keeps sibling dimensions and adds the SKU group below them', () => {
    const wrapper = mountSkuChoice({
      variantDimensions: [row('Färg', 'klar')],
      variants: [
        { alias: 'a', dimension: 'Färg', value: 'klar' },
        { alias: 'b', dimension: 'Färg', value: 'tonad' },
      ] satisfies VariantNode[],
    });

    const triggers = wrapper
      .findAll('[data-testid^="variant-trigger-"]')
      .map((t) => t.attributes('data-testid'));
    expect(triggers).toEqual(['variant-trigger-Färg', 'variant-trigger-sku']);
  });

  it('shows an internal dimension with several values under the generic heading', () => {
    const wrapper = mountSkuChoice({
      skuOptions: [],
      variants: [
        { alias: 'a', dimension: 'DefaultProduct', value: 'a', label: 'A' },
        { alias: 'b', dimension: 'DefaultProduct', value: 'b', label: 'B' },
      ] satisfies VariantNode[],
    });

    expect(
      wrapper.find('[data-testid="variant-trigger-DefaultProduct"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).not.toContain('DefaultProduct');
    expect(wrapper.text()).toContain('product.variant_heading');
  });
});
