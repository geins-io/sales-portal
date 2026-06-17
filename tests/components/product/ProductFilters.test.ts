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
    template: '<div data-testid="filter-sheet"><slot /></div>',
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
    template:
      '<div class="filter-group" :data-facet-id="facet.filterId" :data-value-count="facet.values.length" />',
    props: ['facet', 'selected'],
  },
  ProductFilterGroup: {
    template:
      '<div class="filter-group" :data-facet-id="facet.filterId" :data-value-count="facet.values.length" />',
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

  it('prevents the sheet from auto-focusing on open so the mobile keyboard stays hidden', () => {
    const wrapper = mountComponent(ProductFilters, {
      props: {
        facets: mockFacets,
        modelValue: {},
      },
      global: {
        stubs: defaultStubs,
      },
    });

    // reka-ui fires an `openAutoFocus` event on the sheet content; the
    // component must call preventDefault so the filter-search input is not
    // focused (which would pop the soft keyboard and hide the filters).
    const sheet = wrapper.findComponent('[data-testid="filter-sheet"]');
    const event = new Event('focus', { cancelable: true });
    sheet.vm.$emit('openAutoFocus', event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('renders Clear all and Show results buttons in the footer', () => {
    const wrapper = mountComponent(ProductFilters, {
      props: {
        facets: mockFacets,
        modelValue: {},
      },
      global: {
        stubs: defaultStubs,
      },
    });
    const text = wrapper.text();
    expect(text).toContain('product.clear_all');
    expect(text).toContain('product.show_results');
  });

  describe('search within filter groups', () => {
    const facetsWithHidden = [
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
          {
            _id: 'hidden-green',
            count: 2,
            facetId: 'color',
            parentId: null,
            label: 'Green',
            order: 2,
            hidden: true,
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

    it('empty query renders all facets unchanged', () => {
      const wrapper = mountComponent(ProductFilters, {
        props: {
          facets: mockFacets,
          modelValue: {},
        },
        global: { stubs: defaultStubs },
      });
      const groups = wrapper.findAll('.filter-group');
      expect(groups).toHaveLength(2);
    });

    it('value-label query narrows matching group to only matching values and drops non-matching groups', async () => {
      const wrapper = mountComponent(ProductFilters, {
        props: {
          facets: mockFacets,
          modelValue: {},
        },
        global: { stubs: defaultStubs },
      });

      const input = wrapper.find('input');
      await input.setValue('red');

      const groups = wrapper.findAll('.filter-group');
      expect(groups).toHaveLength(1);
      expect(groups[0]!.attributes('data-facet-id')).toBe('color');
      expect(groups[0]!.attributes('data-value-count')).toBe('1');
    });

    it('group displayed label query keeps all values in that group', async () => {
      const facetsForLabelMatch = [
        {
          filterId: 'color',
          group: '',
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
          group: '',
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
          ],
        },
      ];

      const wrapper = mountComponent(ProductFilters, {
        props: {
          facets: facetsForLabelMatch,
          modelValue: {},
        },
        global: { stubs: defaultStubs },
      });

      const input = wrapper.find('input');
      await input.setValue('color');

      const groups = wrapper.findAll('.filter-group');
      expect(groups).toHaveLength(1);
      expect(groups[0]!.attributes('data-facet-id')).toBe('color');
      expect(groups[0]!.attributes('data-value-count')).toBe('2');
    });

    it('hidden values never surface in a narrowed group', async () => {
      const wrapper = mountComponent(ProductFilters, {
        props: {
          facets: facetsWithHidden,
          modelValue: {},
        },
        global: { stubs: defaultStubs },
      });

      const input = wrapper.find('input');
      await input.setValue('green');

      const groups = wrapper.findAll('.filter-group');
      expect(groups).toHaveLength(0);
    });

    it('zero-match query renders no filter groups', async () => {
      const wrapper = mountComponent(ProductFilters, {
        props: {
          facets: mockFacets,
          modelValue: {},
        },
        global: { stubs: defaultStubs },
      });

      const input = wrapper.find('input');
      await input.setValue('zzznomatch');

      const groups = wrapper.findAll('.filter-group');
      expect(groups).toHaveLength(0);
    });

    it('narrowed facet preserves filterId', async () => {
      const wrapper = mountComponent(ProductFilters, {
        props: {
          facets: mockFacets,
          modelValue: {},
        },
        global: { stubs: defaultStubs },
      });

      const input = wrapper.find('input');
      await input.setValue('blue');

      const groups = wrapper.findAll('.filter-group');
      expect(groups).toHaveLength(1);
      expect(groups[0]!.attributes('data-facet-id')).toBe('color');
    });

    it('group mapped through GROUP_KEY_MAP hits the t() branch and keeps all group values', async () => {
      // group:'Price' normalises to 'price', which maps to key 'price' in
      // GROUP_KEY_MAP. With the test $t passthrough (returns the key as-is),
      // the displayed label becomes 'product.filter_groups.price'. Searching
      // for a substring of that resolves via getFilterGroupLabel's t() path,
      // not the label fallback path (which is what the custom facet below uses).
      const priceFacet = {
        filterId: 'Price',
        group: 'Price',
        label: 'Price',
        type: 'Price',
        values: [
          {
            _id: 'price_100',
            count: 8,
            facetId: 'Price',
            parentId: null,
            label: 'Under 100',
            order: 0,
            hidden: false,
          },
          {
            _id: 'price_500',
            count: 3,
            facetId: 'Price',
            parentId: null,
            label: 'Under 500',
            order: 1,
            hidden: false,
          },
        ],
      };
      // Control: a custom product-parameter facet whose group / type / filterId
      // are all unknown, so it falls back to its raw label ('Color') and never
      // contains the 'filter_groups' substring.
      const customFacet = {
        filterId: 'color',
        group: 'Color',
        label: 'Color',
        type: 'Parameter',
        values: [
          {
            _id: 'acme',
            count: 2,
            facetId: 'color',
            parentId: null,
            label: 'Acme',
            order: 0,
            hidden: false,
          },
        ],
      };

      const wrapper = mountComponent(ProductFilters, {
        props: {
          facets: [priceFacet, customFacet],
          modelValue: {},
        },
        global: { stubs: defaultStubs },
      });

      // 'filter_groups' is a substring of the resolved label
      // 'product.filter_groups.price' returned by t() for the Price group
      const input = wrapper.find('input');
      await input.setValue('filter_groups');

      const groups = wrapper.findAll('.filter-group');
      // Only the Price group matches (its t()-resolved label contains the query)
      expect(groups).toHaveLength(1);
      expect(groups[0]!.attributes('data-facet-id')).toBe('Price');
      // All values of the matching group are kept (group match, not value match)
      expect(groups[0]!.attributes('data-value-count')).toBe('2');
    });
  });
});
