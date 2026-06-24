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
    template: '<input type="checkbox" />',
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
