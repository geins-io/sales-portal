import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductListToolbar from '../../../app/components/product/ProductListToolbar.vue';

const sortOptions = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price: Low to High', value: 'price-asc' },
];

const SortDropdownStub = {
  template:
    '<select class="sort-dropdown" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
};

const ViewToggleStub = {
  template:
    "<div class=\"view-toggle\" @click=\"$emit('update:modelValue', modelValue === 'grid' ? 'list' : 'grid')\" />",
  props: ['modelValue'],
  emits: ['update:modelValue'],
};

const SearchStub = {
  template: '<span class="search-icon" />',
};

const defaultStubs = {
  SortDropdown: SortDropdownStub,
  ProductSortDropdown: SortDropdownStub,
  ViewToggle: ViewToggleStub,
  ProductViewToggle: ViewToggleStub,
  Search: SearchStub,
};

function mountToolbar(overrides: Record<string, unknown> = {}) {
  return mount(ProductListToolbar, {
    props: {
      resultCount: 42,
      sortValue: 'relevance',
      sortOptions,
      viewMode: 'grid' as const,
      filterText: '',
      ...overrides,
    },
    global: { stubs: defaultStubs },
  });
}

describe('ProductListToolbar', () => {
  it('does not display the result count in the toolbar', () => {
    const wrapper = mountToolbar();
    expect(wrapper.text()).not.toContain('42 products');
  });

  it('renders SortDropdown', () => {
    const wrapper = mountToolbar();
    expect(wrapper.find('.sort-dropdown').exists()).toBe(true);
  });

  it('renders ViewToggle', () => {
    const wrapper = mountToolbar();
    expect(wrapper.find('.view-toggle').exists()).toBe(true);
  });

  it('renders the quick filter input', () => {
    const wrapper = mountToolbar();
    expect(wrapper.find('input[data-slot="input"]').exists()).toBe(true);
  });

  it('emits update:sortValue when SortDropdown changes', async () => {
    const wrapper = mountToolbar();

    const select = wrapper.find('.sort-dropdown');
    await select.setValue('price-asc');
    const emitted = wrapper.emitted('update:sortValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toBe('price-asc');
  });

  it('emits update:viewMode when ViewToggle is clicked', async () => {
    const wrapper = mountToolbar();

    await wrapper.find('.view-toggle').trigger('click');
    const emitted = wrapper.emitted('update:viewMode');
    expect(emitted).toBeTruthy();
  });

  it('emits update:filterText when filter input changes', async () => {
    const wrapper = mountToolbar();

    const input = wrapper.find('input[data-slot="input"]');
    await input.setValue('test query');
    const emitted = wrapper.emitted('update:filterText');
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toBe('test query');
  });
});
