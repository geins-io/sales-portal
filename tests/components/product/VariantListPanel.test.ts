import { describe, it, expect } from 'vitest';
import { nextTick } from 'vue';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import { mountComponent } from '../../utils/component';
import VariantListPanel from '../../../app/components/product/VariantListPanel.vue';
import VariantSheetRow from '../../../app/components/product/VariantSheetRow.vue';
import type { VariantRow } from '../../../app/utils/variant-rows';
import type { StockType } from '#shared/types/commerce';

const stock = (totalStock: number): StockType => ({
  inStock: totalStock,
  oversellable: 0,
  totalStock,
  static: 0,
});

const row = (n: number, overrides: Partial<VariantRow> = {}): VariantRow => ({
  key: `v${n}`,
  label: `Svart, ${n}`,
  name: 'Jacka',
  articleNumber: `ART-${n}`,
  stock: stock(5),
  price: `${n}00 kr`,
  image: { fileName: `v${n}.jpg`, url: null },
  selected: false,
  ...overrides,
});

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => row(i + 1));

const sheetStubs = {
  Sheet: {
    template: '<div v-if="open"><slot /></div>',
    props: ['open'],
  },
  SheetContent: {
    template: '<div><slot /></div>',
    props: ['side', 'class'],
  },
  SheetHeader: { template: '<div><slot /></div>' },
  SheetTitle: { template: '<h2><slot /></h2>' },
};

function mountPanel(
  props: Partial<InstanceType<typeof VariantListPanel>['$props']> = {},
) {
  return mountComponent(VariantListPanel, {
    props: { kind: 'variant', rows: rows(3), ...props },
    global: { stubs: sheetStubs },
  });
}

async function open(wrapper: ReturnType<typeof mountPanel>, kind = 'variant') {
  await wrapper.find(`[data-testid="${kind}-list-trigger"]`).trigger('click');
}

describe('VariantListPanel', () => {
  it('labels sibling variants "Variant" and shows the picked one on a trigger pointing right', () => {
    const wrapper = mountPanel({
      rows: [row(1), row(2, { selected: true })],
    });
    expect(wrapper.text()).toContain('product.variant_dimension_heading');
    const trigger = wrapper.find('[data-testid="variant-list-trigger"]');
    expect(trigger.text()).toBe('Svart, 2');
    expect(trigger.findComponent(ChevronRight).exists()).toBe(true);
    expect(trigger.findComponent(ChevronDown).exists()).toBe(false);
    expect(trigger.classes()).toEqual(
      expect.arrayContaining(['h-11', 'w-full', 'lg:max-w-80', 'bg-muted/50']),
    );
  });

  it('labels SKUs "Type" and asks to choose before a pick', () => {
    const wrapper = mountPanel({ kind: 'sku' });
    expect(wrapper.text()).toContain('product.variant_heading');
    expect(wrapper.find('[data-testid="sku-list-trigger"]').text()).toBe(
      'product.select_variant_placeholder',
    );
  });

  it('opens one list of every row with its label, name, article number, stock, price and image', async () => {
    const wrapper = mountPanel();
    expect(wrapper.find('[data-testid="variant-list-sheet"]').exists()).toBe(
      false,
    );
    await open(wrapper);
    expect(wrapper.find('[data-testid="variant-list-sheet"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('h2').text()).toBe('product.select_variant');
    const sheetRows = wrapper.findAllComponents(VariantSheetRow);
    expect(sheetRows).toHaveLength(3);
    expect(sheetRows[0]!.props()).toMatchObject({
      title: 'Svart, 1',
      subtitle: 'Jacka',
      articleNumber: 'ART-1',
      stock: stock(5),
      price: '100 kr',
      imageFileName: 'v1.jpg',
      selected: false,
    });
  });

  it('titles the SKU sheet "Choose a type"', async () => {
    const wrapper = mountPanel({ kind: 'sku' });
    await open(wrapper, 'sku');
    expect(wrapper.find('h2').text()).toBe('product.select_type');
  });

  it('tells a row known to have no image from one still loading', async () => {
    const wrapper = mountPanel({
      rows: [row(1, { image: null }), row(2, { image: undefined })],
    });
    await open(wrapper);
    const [none, loading] = wrapper.findAllComponents(VariantSheetRow);
    expect(none!.props('imageMissing')).toBe(true);
    expect(loading!.props('imageMissing')).toBe(false);
  });

  it('has no search with 7 rows', async () => {
    const wrapper = mountPanel({ rows: rows(7) });
    await open(wrapper);
    expect(wrapper.find('[data-testid="variant-list-search"]').exists()).toBe(
      false,
    );
  });

  it('searches from 8 rows, on the values and the article number', async () => {
    const wrapper = mountPanel({
      rows: [...rows(7), row(8, { label: 'Marinblå, XL' })],
    });
    await open(wrapper);
    const search = wrapper.find('[data-testid="variant-list-search"]');
    expect(search.exists()).toBe(true);
    await search.setValue('marinblå');
    expect(
      wrapper.findAllComponents(VariantSheetRow).map((r) => r.props('title')),
    ).toEqual(['Marinblå, XL']);
    await search.setValue('art-3');
    expect(
      wrapper.findAllComponents(VariantSheetRow).map((r) => r.props('title')),
    ).toEqual(['Svart, 3']);
  });

  it('says so when the search finds nothing', async () => {
    const wrapper = mountPanel({ rows: rows(8) });
    await open(wrapper);
    await wrapper
      .find('[data-testid="variant-list-search"]')
      .setValue('nothing like this');
    expect(wrapper.findAllComponents(VariantSheetRow)).toHaveLength(0);
    expect(wrapper.find('[data-testid="variant-list-empty"]').text()).toBe(
      'product.variant_no_match',
    );
  });

  it('keeps an out-of-stock row selectable and shows its stock', async () => {
    const wrapper = mountPanel({ rows: [row(1, { stock: stock(0) })] });
    await open(wrapper);
    const sheetRow = wrapper.findComponent(VariantSheetRow);
    expect(sheetRow.props('disabled')).toBeFalsy();
    expect(sheetRow.props('stock')).toEqual(stock(0));
    await sheetRow.trigger('click');
    expect(wrapper.emitted('select')).toEqual([['v1']]);
  });

  it('emits the picked row and closes, clearing the search', async () => {
    const wrapper = mountPanel({ rows: rows(8) });
    await open(wrapper);
    await wrapper.find('[data-testid="variant-list-search"]').setValue('art-2');
    await wrapper.findComponent(VariantSheetRow).trigger('click');
    expect(wrapper.emitted('select')).toEqual([['v2']]);
    expect(wrapper.find('[data-testid="variant-list-sheet"]').exists()).toBe(
      false,
    );
    await open(wrapper);
    expect(wrapper.findAllComponents(VariantSheetRow)).toHaveLength(8);
  });

  it('opens from outside through open()', async () => {
    const wrapper = mountPanel({ kind: 'sku' });
    (wrapper.vm as unknown as { open: () => void }).open();
    await nextTick();
    expect(wrapper.find('[data-testid="sku-list-sheet"]').exists()).toBe(true);
  });

  it('disables the trigger while the page changes', () => {
    const wrapper = mountPanel({ disabled: true });
    expect(
      wrapper
        .find('[data-testid="variant-list-trigger"]')
        .attributes('disabled'),
    ).toBeDefined();
  });
});
