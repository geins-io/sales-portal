import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../utils/component';

import ProductFilters from '../../../app/components/product/ProductFilters.vue';

// Mock explicitly imported modules so stubs render correctly
vi.mock('../../../app/components/ui/sheet', () => ({
  Sheet: {
    template: '<div><slot /></div>',
    props: ['open'],
  },
  SheetContent: {
    template: '<div><slot /></div>',
    props: ['side'],
  },
  SheetHeader: {
    template: '<div><slot /></div>',
  },
  SheetTitle: {
    template: '<div><slot /></div>',
  },
}));

vi.mock('../../../app/components/ui/button', () => ({
  Button: {
    template: '<button><slot /></button>',
    props: ['size', 'variant'],
  },
}));

const mockFacets = [
  {
    filterId: 'color',
    group: 'attributes',
    label: 'Color',
    type: 'multi',
    values: [
      {
        _id: 'red',
        count: 5,
        facetId: 'color',
        parentId: null,
        label: 'Red',
        order: 0,
        hidden: false,
      },
      {
        _id: 'blue',
        count: 3,
        facetId: 'color',
        parentId: null,
        label: 'Blue',
        order: 1,
        hidden: false,
      },
    ],
  },
  {
    filterId: 'size',
    group: 'attributes',
    label: 'Size',
    type: 'multi',
    values: [
      {
        _id: 'small',
        count: 4,
        facetId: 'size',
        parentId: null,
        label: 'Small',
        order: 0,
        hidden: false,
      },
      {
        _id: 'large',
        count: 6,
        facetId: 'size',
        parentId: null,
        label: 'Large',
        order: 1,
        hidden: false,
      },
    ],
  },
];

const defaultStubs = {
  FilterGroup: {
    template: '<div class="filter-group" :data-facet-id="facet.filterId" />',
    props: ['facet', 'selected'],
  },
  ProductFilterGroup: {
    template: '<div class="filter-group" :data-facet-id="facet.filterId" />',
    props: ['facet', 'selected'],
  },
  SlidersHorizontal: true,
};

describe('ProductFilters', () => {
  it('renders a filters button', () => {
    const wrapper = mountComponent(ProductFilters, {
      props: {
        facets: mockFacets,
        modelValue: {},
      },
      global: {
        stubs: defaultStubs,
      },
    });
    const button = wrapper.find('button');
    expect(button.exists()).toBe(true);
    expect(button.text()).toContain('product.filters');
  });

  it('renders FilterGroups inside the sheet', () => {
    const wrapper = mountComponent(ProductFilters, {
      props: {
        facets: mockFacets,
        modelValue: {},
      },
      global: {
        stubs: defaultStubs,
      },
    });
    const groups = wrapper.findAll('.filter-group');
    expect(groups).toHaveLength(2);
  });

  it('emits update:modelValue when a facet is updated', async () => {
    const FilterGroupStub = {
      template:
        '<div class="filter-group" @click="$emit(\'update:selected\', [\'red\'])" />',
      props: ['facet', 'selected'],
      emits: ['update:selected'],
    };

    const wrapper = mountComponent(ProductFilters, {
      props: {
        facets: mockFacets,
        modelValue: {},
      },
      global: {
        stubs: {
          ...defaultStubs,
          FilterGroup: FilterGroupStub,
          ProductFilterGroup: FilterGroupStub,
        },
      },
    });

    await wrapper.find('.filter-group').trigger('click');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toEqual({ color: ['red'] });
  });

  it('removes facet key when selected is empty', async () => {
    const FilterGroupStub = {
      template:
        '<div class="filter-group" @click="$emit(\'update:selected\', [])" />',
      props: ['facet', 'selected'],
      emits: ['update:selected'],
    };

    const wrapper = mountComponent(ProductFilters, {
      props: {
        facets: mockFacets,
        modelValue: { color: ['red'] },
      },
      global: {
        stubs: {
          ...defaultStubs,
          FilterGroup: FilterGroupStub,
          ProductFilterGroup: FilterGroupStub,
        },
      },
    });

    await wrapper.find('.filter-group').trigger('click');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    // color key should be removed since selected is empty
    expect(emitted![0]![0]).toEqual({});
  });
});
