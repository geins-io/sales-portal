import { describe, it, expect } from 'vitest';
import { shallowMount } from '@vue/test-utils';
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

const defaultStubs = {
  SortDropdown: SortDropdownStub,
  ProductSortDropdown: SortDropdownStub,
  ViewToggle: ViewToggleStub,
  ProductViewToggle: ViewToggleStub,
};

describe('ProductListToolbar', () => {
  it('displays the result count', () => {
    const wrapper = shallowMount(ProductListToolbar, {
      props: {
        resultCount: 42,
        sortValue: 'relevance',
        sortOptions,
        viewMode: 'grid' as const,
      },
      global: { stubs: defaultStubs },
    });
    expect(wrapper.text()).toContain('42 products');
  });

  it('uses singular "product" when count is 1', () => {
    const wrapper = shallowMount(ProductListToolbar, {
      props: {
        resultCount: 1,
        sortValue: 'relevance',
        sortOptions,
        viewMode: 'grid' as const,
      },
      global: { stubs: defaultStubs },
    });
    expect(wrapper.text()).toContain('1 product');
    expect(wrapper.text()).not.toContain('1 products');
  });

  it('renders SortDropdown', () => {
    const wrapper = shallowMount(ProductListToolbar, {
      props: {
        resultCount: 10,
        sortValue: 'relevance',
        sortOptions,
        viewMode: 'grid' as const,
      },
      global: { stubs: defaultStubs },
    });
    expect(wrapper.find('.sort-dropdown').exists()).toBe(true);
  });

  it('renders ViewToggle', () => {
    const wrapper = shallowMount(ProductListToolbar, {
      props: {
        resultCount: 10,
        sortValue: 'relevance',
        sortOptions,
        viewMode: 'grid' as const,
      },
      global: { stubs: defaultStubs },
    });
    expect(wrapper.find('.view-toggle').exists()).toBe(true);
  });

  it('emits update:sortValue when SortDropdown changes', async () => {
    const wrapper = shallowMount(ProductListToolbar, {
      props: {
        resultCount: 10,
        sortValue: 'relevance',
        sortOptions,
        viewMode: 'grid' as const,
      },
      global: { stubs: defaultStubs },
    });

    const select = wrapper.find('.sort-dropdown');
    await select.setValue('price-asc');
    const emitted = wrapper.emitted('update:sortValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toBe('price-asc');
  });

  it('emits update:viewMode when ViewToggle is clicked', async () => {
    const wrapper = shallowMount(ProductListToolbar, {
      props: {
        resultCount: 10,
        sortValue: 'relevance',
        sortOptions,
        viewMode: 'grid' as const,
      },
      global: { stubs: defaultStubs },
    });

    await wrapper.find('.view-toggle').trigger('click');
    const emitted = wrapper.emitted('update:viewMode');
    expect(emitted).toBeTruthy();
  });
});
