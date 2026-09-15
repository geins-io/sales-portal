import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import FilterGroup from '../../../app/components/product/FilterGroup.vue';
import type { FilterFacet, FilterValue } from '../../../shared/types/commerce';

function makeValue(overrides: Partial<FilterValue>): FilterValue {
  return {
    _id: 'v',
    count: 1,
    facetId: 'v',
    parentId: null,
    label: 'Value',
    order: 0,
    hidden: false,
    ...overrides,
  };
}

function makeFacet(values: FilterValue[]): FilterFacet {
  return {
    filterId: 'size',
    group: '',
    label: 'Size',
    type: 'Sku',
    values,
  };
}

const stubs = {
  Accordion: {
    template: '<div data-stub="accordion"><slot /></div>',
    props: ['type', 'collapsible', 'defaultValue'],
  },
  AccordionItem: {
    template: '<div data-stub="accordion-item"><slot /></div>',
    props: ['value'],
  },
  AccordionTrigger: {
    template: '<div data-stub="accordion-trigger"><slot /></div>',
  },
  AccordionContent: { template: '<div><slot /></div>' },
  Checkbox: {
    template: '<input type="checkbox" :id="id" />',
    props: ['id', 'modelValue', 'disabled'],
  },
};

function mountFilterGroup(facet: FilterFacet) {
  return mountComponent(FilterGroup, {
    props: { facet, selected: [] },
    global: { stubs },
  });
}

describe('FilterGroup', () => {
  it('renders the group when it has real values', () => {
    const wrapper = mountFilterGroup(
      makeFacet([
        makeValue({ _id: 'small', facetId: 'small', label: 'Small' }),
        makeValue({ _id: 'large', facetId: 'large', label: 'Large' }),
      ]),
    );
    expect(wrapper.find('[data-stub="accordion"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Small');
    expect(wrapper.text()).toContain('Large');
  });

  it('hides the group when its only available value is "-"', () => {
    const wrapper = mountFilterGroup(
      makeFacet([makeValue({ _id: 'dash', facetId: 'dash', label: '-' })]),
    );
    expect(wrapper.find('[data-stub="accordion"]').exists()).toBe(false);
  });

  it('hides the group when every available value is "-"', () => {
    const wrapper = mountFilterGroup(
      makeFacet([
        makeValue({ _id: 'a', facetId: 'a', label: '-' }),
        makeValue({ _id: 'b', facetId: 'b', label: ' - ' }),
      ]),
    );
    expect(wrapper.find('[data-stub="accordion"]').exists()).toBe(false);
  });

  it('hides the group (without throwing) when every value has a null label', () => {
    // Geins returns a `ParameterValue` facet whose values carry null labels.
    // Calling `.trim()` on these used to crash the whole PLP filter render.
    const wrapper = mountFilterGroup(
      makeFacet([
        makeValue({ _id: 'a', facetId: 'a', label: null }),
        makeValue({ _id: 'b', facetId: 'b', label: null }),
      ]),
    );
    expect(wrapper.find('[data-stub="accordion"]').exists()).toBe(false);
  });

  it('still renders when a null label appears alongside a real value', () => {
    const wrapper = mountFilterGroup(
      makeFacet([
        makeValue({ _id: 'null', facetId: 'null', label: null }),
        makeValue({ _id: 'small', facetId: 'small', label: 'Small' }),
      ]),
    );
    expect(wrapper.find('[data-stub="accordion"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Small');
  });

  it('still renders when "-" appears alongside a real value', () => {
    const wrapper = mountFilterGroup(
      makeFacet([
        makeValue({ _id: 'dash', facetId: 'dash', label: '-' }),
        makeValue({ _id: 'small', facetId: 'small', label: 'Small' }),
      ]),
    );
    expect(wrapper.find('[data-stub="accordion"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Small');
  });

  describe('checkbox ids', () => {
    // Values taken from a live Geins Sku facet: an inch measurement, a plain
    // number, a phrase with spaces, and an en dash with å/ä. The quote used to
    // crash the whole page; the rest are there so the next awkward value the
    // catalogue grows is covered too.
    const awkward = [
      makeValue({ _id: 'sku_10"_1', facetId: 'sku_10"', label: '10"' }),
      makeValue({ _id: 'sku_10_1', facetId: 'sku_10', label: '10' }),
      makeValue({
        _id: 'sku_Borrset HSS 19 delar_1',
        facetId: 'sku_Borrset HSS 19 delar',
        label: 'Borrset HSS 19 delar',
      }),
      makeValue({
        _id: 'sku_Momentnyckel 40–200 Nm_1',
        facetId: 'sku_Momentnyckel 40–200 Nm',
        label: 'Momentnyckel 40–200 Nm',
      }),
    ];

    it('keeps label and checkbox associated for awkward facet values', () => {
      const wrapper = mountFilterGroup(makeFacet(awkward));
      const labels = wrapper.findAll('label');
      const boxes = wrapper.findAll('input[type="checkbox"]');
      expect(labels).toHaveLength(awkward.length);
      for (const [i, label] of labels.entries()) {
        expect(label.attributes('for')).toBe(boxes[i]!.attributes('id'));
      }
    });

    it('gives distinct ids to values that differ only in punctuation', () => {
      const wrapper = mountFilterGroup(makeFacet(awkward));
      const ids = wrapper
        .findAll('input[type="checkbox"]')
        .map((box) => box.attributes('id'));
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('builds ids a browser accepts in a selector', () => {
      // `reka-ui` resolves a checkbox's aria-label with
      // `document.querySelector('[for="<id>"]')`. A quote in the id throws
      // there in a browser and takes the whole page down; happy-dom parses the
      // same selector leniently, so assert the id shape instead. The alphabet
      // is what `encodeURIComponent` can emit; none of it closes a
      // double-quoted CSS string.
      const wrapper = mountFilterGroup(makeFacet(awkward));
      for (const box of wrapper.findAll('input[type="checkbox"]')) {
        expect(box.attributes('id')).toMatch(/^[A-Za-z][\w%.~!*'()-]*$/);
      }
    });

    it('keeps every id when a refetch hides the value above it', async () => {
      // reka-ui caches the label text it finds for an id, and the DOM it
      // searches is not reactive. An id that moves with the row would leave
      // every checkbox below a hidden value announcing its neighbour's label.
      const wrapper = mountFilterGroup(makeFacet(awkward));
      const before = wrapper
        .findAll('input[type="checkbox"]')
        .map((box) => box.attributes('id'));
      await wrapper.setProps({
        facet: makeFacet([
          { ...awkward[0]!, hidden: true },
          ...awkward.slice(1),
        ]),
      });
      const after = wrapper
        .findAll('input[type="checkbox"]')
        .map((box) => box.attributes('id'));
      expect(after).toEqual(before.slice(1));
    });
  });

  it('gives each option row py-3 touch padding and tightens the row gap to gap-1', () => {
    const wrapper = mountFilterGroup(
      makeFacet([
        makeValue({ _id: 'small', facetId: 'small', label: 'Small' }),
        makeValue({ _id: 'large', facetId: 'large', label: 'Large' }),
      ]),
    );
    const labels = wrapper.findAll('label');
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(label.classes()).toContain('py-3');
    }
    // The list container tightens to gap-1 now that each row carries py-3.
    const container = labels[0]!.element.parentElement as HTMLElement;
    expect(container.className).toContain('gap-1');
    expect(container.className).not.toContain('gap-3');
  });
});
