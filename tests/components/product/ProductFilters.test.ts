import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import ProductFilters from '../../../app/components/product/ProductFilters.vue';

// Mock @vueuse/core useMediaQuery
vi.mock('@vueuse/core', async () => {
  const actual =
    await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core');
  return {
    ...actual,
    useMediaQuery: vi.fn(() => ({ value: true })),
  };
});

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
};

describe('ProductFilters', () => {
  it('renders a FilterGroup for each facet on desktop', () => {
    const wrapper = shallowMount(ProductFilters, {
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

  it('passes correct selected values to FilterGroup', () => {
    const wrapper = shallowMount(ProductFilters, {
      props: {
        facets: mockFacets,
        modelValue: { color: ['red'] },
      },
      global: {
        stubs: defaultStubs,
      },
    });
    const groups = wrapper.findAll('.filter-group');
    const colorGroup = groups.find(
      (g) => g.attributes('data-facet-id') === 'color',
    );
    expect(colorGroup).toBeTruthy();
  });

  it('emits update:modelValue when a facet is updated', async () => {
    const FilterGroupStub = {
      template:
        '<div class="filter-group" @click="$emit(\'update:selected\', [\'red\'])" />',
      props: ['facet', 'selected'],
      emits: ['update:selected'],
    };

    const wrapper = shallowMount(ProductFilters, {
      props: {
        facets: mockFacets,
        modelValue: {},
      },
      global: {
        stubs: {
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

    const wrapper = shallowMount(ProductFilters, {
      props: {
        facets: mockFacets,
        modelValue: { color: ['red'] },
      },
      global: {
        stubs: {
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
