import { describe, it, expect } from 'vitest';
import { nextTick } from 'vue';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import { mountComponent } from '../../utils/component';
import VariantListDropdown from '../../../app/components/product/VariantListDropdown.vue';
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
  stock: stock(20),
  price: `${n}00 kr`,
  image: { fileName: `v${n}.jpg`, url: null },
  selected: false,
  ...overrides,
});

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => row(i + 1));

// The popover and the listbox are reka primitives; these stand-ins keep their
// contracts (v-model:open, the item's select event) and render inline.
const Popover = {
  name: 'Popover',
  props: ['open'],
  emits: ['update:open'],
  template: '<div :data-open="String(open)"><slot /></div>',
};
const stubs = {
  Popover,
  PopoverTrigger: { template: '<div><slot /></div>' },
  PopoverContent: {
    template:
      '<div data-testid="popover-content" :class="$attrs.class"><slot /></div>',
  },
  Command: { template: '<div><slot /></div>', props: ['modelValue'] },
  CommandList: {
    template:
      '<div data-testid="command-list" :class="$attrs.class"><slot /></div>',
  },
  CommandGroup: { template: '<div><slot /></div>' },
  CommandItem: {
    props: ['value'],
    emits: ['select'],
    template:
      '<div role="option" :data-value="value" :class="$attrs.class" @click="$emit(\'select\')"><slot /></div>',
  },
  ListboxFilter: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
};

function mountDropdown(
  props: Partial<InstanceType<typeof VariantListDropdown>['$props']> = {},
) {
  return mountComponent(VariantListDropdown, {
    props: { kind: 'variant', rows: rows(3), ...props },
    global: { stubs },
  });
}

const options = (wrapper: ReturnType<typeof mountDropdown>) =>
  wrapper.findAll('[data-testid="variant-dropdown-option"]');

describe('VariantListDropdown', () => {
  it('labels sibling variants "Variant" and shows the picked one on a trigger pointing down', () => {
    const wrapper = mountDropdown({
      rows: [row(1), row(2, { selected: true })],
    });
    expect(wrapper.text()).toContain('product.variant_dimension_heading');
    const trigger = wrapper.find('[data-testid="variant-dropdown-trigger"]');
    expect(trigger.text()).toBe('Svart, 2');
    expect(trigger.attributes('role')).toBe('combobox');
    expect(trigger.findComponent(ChevronDown).exists()).toBe(true);
    expect(trigger.findComponent(ChevronRight).exists()).toBe(false);
    expect(trigger.classes()).toEqual(
      expect.arrayContaining(['h-11', 'w-full', 'lg:max-w-80', 'bg-muted/50']),
    );
  });

  it('labels SKUs "Type" and asks to choose before a pick', () => {
    const wrapper = mountDropdown({ kind: 'sku' });
    expect(wrapper.text()).toContain('product.variant_heading');
    expect(wrapper.find('[data-testid="sku-dropdown-trigger"]').text()).toBe(
      'product.select_variant_placeholder',
    );
  });

  it('lists every row with its values, article number, stock and price, no image', () => {
    const wrapper = mountDropdown();
    const [first] = options(wrapper);
    expect(options(wrapper)).toHaveLength(3);
    expect(first!.text()).toContain('Svart, 1');
    expect(first!.text()).toContain('product.article_number');
    expect(first!.text()).toContain('product.in_stock');
    expect(first!.find('[data-testid="variant-dropdown-price"]').text()).toBe(
      '100 kr',
    );
    expect(first!.find('img').exists()).toBe(false);
  });

  it('marks the current row', () => {
    const wrapper = mountDropdown({
      rows: [row(1), row(2, { selected: true })],
    });
    const marks = options(wrapper).map((o) =>
      o.find('[data-testid="variant-dropdown-check"]').classes(),
    );
    expect(marks[0]).toContain('opacity-0');
    expect(marks[1]).toContain('opacity-100');
  });

  it('leaves no room for a check mark while no row is picked', () => {
    const wrapper = mountDropdown({ kind: 'sku' });
    expect(wrapper.find('[data-testid="sku-dropdown-check"]').exists()).toBe(
      false,
    );
  });

  it('caps the list at one height and scrolls past it', () => {
    const wrapper = mountDropdown();
    expect(wrapper.find('[data-testid="command-list"]').classes()).toContain(
      'max-h-80',
    );
  });

  it('darkens the grey text on the highlighted row', () => {
    const wrapper = mountDropdown();
    const [first] = options(wrapper);
    expect(first!.classes()).toContain('group');
    const meta = first!.find('[data-testid="variant-dropdown-meta"]');
    expect(meta.classes()).toContain('text-muted-foreground');
    expect(
      meta
        .classes()
        .some((c) => c.startsWith('group-data-highlighted:text-foreground')),
    ).toBe(true);
  });

  it('has no search with 7 rows', () => {
    const wrapper = mountDropdown({ rows: rows(7) });
    expect(
      wrapper.find('[data-testid="variant-dropdown-search"]').exists(),
    ).toBe(false);
  });

  it('searches from 8 rows, on the values and the article number', async () => {
    const wrapper = mountDropdown({
      rows: [...rows(7), row(8, { label: 'Marinblå, XL' })],
    });
    const search = wrapper.find(
      '[data-testid="variant-dropdown-search"] input',
    );
    await search.setValue('MARINBLÅ');
    expect(options(wrapper).map((o) => o.attributes('data-value'))).toEqual([
      'v8',
    ]);
    await search.setValue('art-3');
    expect(options(wrapper).map((o) => o.attributes('data-value'))).toEqual([
      'v3',
    ]);
    await search.setValue('nothing like this');
    expect(options(wrapper)).toHaveLength(0);
    expect(wrapper.find('[data-testid="variant-dropdown-empty"]').text()).toBe(
      'product.variant_no_match',
    );
  });

  it('keeps an out-of-stock row selectable and shows its stock', async () => {
    const wrapper = mountDropdown({ rows: [row(1, { stock: stock(0) })] });
    const [option] = options(wrapper);
    expect(option!.text()).toContain('product.out_of_stock');
    await option!.trigger('click');
    expect(wrapper.emitted('select')).toEqual([['v1']]);
  });

  it('emits the picked row and closes', async () => {
    const wrapper = mountDropdown();
    wrapper.findComponent(Popover).vm.$emit('update:open', true);
    await nextTick();
    await options(wrapper)[1]!.trigger('click');
    expect(wrapper.emitted('select')).toEqual([['v2']]);
    expect(wrapper.findComponent(Popover).props('open')).toBe(false);
  });

  it('leaves the price column out where there is no price', () => {
    const wrapper = mountDropdown({ rows: [row(1, { price: null })] });
    expect(
      wrapper.find('[data-testid="variant-dropdown-price"]').exists(),
    ).toBe(false);
  });

  it('opens from outside through open()', async () => {
    const wrapper = mountDropdown({ kind: 'sku' });
    expect(wrapper.findComponent(Popover).props('open')).toBe(false);
    (wrapper.vm as unknown as { open: () => void }).open();
    await nextTick();
    expect(wrapper.findComponent(Popover).props('open')).toBe(true);
  });

  it('disables the trigger while the page changes', () => {
    const wrapper = mountDropdown({ disabled: true });
    expect(
      wrapper
        .find('[data-testid="variant-dropdown-trigger"]')
        .attributes('disabled'),
    ).toBeDefined();
  });
});
