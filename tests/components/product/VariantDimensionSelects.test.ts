import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import VariantDimensionSelects from '../../../app/components/product/VariantDimensionSelects.vue';
import { variantCombinations } from '../../../app/utils/variant-tree';
import {
  pumpCombinations,
  switchCombinations,
  twoDimensionTree,
} from '../../fixtures/variant-trees';

// Reka's Select stand-ins: the root keeps its v-model contract and the
// rest render inline, so every group and item is in the DOM.
const Select = {
  name: 'Select',
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  template: '<div data-testid="select" :data-value="modelValue"><slot /></div>',
};
const stubs = {
  Select,
  SelectTrigger: {
    template:
      '<button :id="$attrs.id" :class="$attrs.class"><slot /><span data-testid="chevron-down" /></button>',
  },
  SelectValue: {
    props: ['placeholder'],
    template: '<span data-testid="select-value"><slot /></span>',
  },
  SelectContent: {
    template:
      '<div data-testid="select-content" :class="$attrs.class"><slot /></div>',
  },
  SelectGroup: { template: '<div><slot /></div>' },
  SelectLabel: { template: '<h4><slot /></h4>' },
  SelectSeparator: { template: '<hr />' },
  SelectItem: {
    props: ['value', 'textValue'],
    template: '<div role="option" :data-value="value"><slot /></div>',
  },
};

function mountSelects(
  props: Partial<InstanceType<typeof VariantDimensionSelects>['$props']> = {},
) {
  return mountComponent(VariantDimensionSelects, {
    props: {
      combinations: pumpCombinations,
      modelValue: { Effekt: '0,37 kW', Spänning: '230 V' },
      ...props,
    },
    global: { stubs },
  });
}

/** The selects in dimension order, as [heading, values] per group. */
function groupsOf(wrapper: ReturnType<typeof mountSelects>, index: number) {
  const select = wrapper.findAll('[data-testid="select"]')[index]!;
  return select
    .findAll('[data-testid^="variant-select-group-"]')
    .map((g) => [
      g.find('h4').exists() ? g.find('h4').text() : null,
      g.findAll('[role="option"]').map((o) => o.text()),
    ]);
}

describe('VariantDimensionSelects', () => {
  it('shows one select per dimension, labelled and holding the current value', () => {
    const wrapper = mountSelects();
    const selects = wrapper.findAllComponents(Select);
    expect(selects.map((s) => s.props('modelValue'))).toEqual([
      '0,37 kW',
      '230 V',
    ]);
    const labels = wrapper.findAll('label');
    expect(labels.map((l) => l.text())).toEqual(['Effekt', 'Spänning']);
    const trigger = wrapper.find(
      '[data-testid="variant-select-trigger-Effekt"]',
    );
    expect(labels[0]!.attributes('for')).toBe(trigger.attributes('id'));
    expect(trigger.classes()).toEqual(
      expect.arrayContaining(['w-full', 'lg:max-w-80', 'bg-muted/50']),
    );
  });

  it('lists the matching values first, then the rest under "More options, changes …"', () => {
    const wrapper = mountSelects();
    expect(groupsOf(wrapper, 0)).toEqual([
      ['product.variant_group_matching_named', ['0,37 kW', '1,5 kW']],
      ['product.variant_group_more_changes', ['0,75 kW']],
    ]);
    expect(
      wrapper.findAll('[data-testid="select"]')[0]!.findAll('hr'),
    ).toHaveLength(1);
  });

  it('has no headings when every value matches', () => {
    const wrapper = mountSelects();
    expect(groupsOf(wrapper, 1)).toEqual([[null, ['230 V', '400 V']]]);
    expect(
      wrapper.findAll('[data-testid="select"]')[1]!.find('hr').exists(),
    ).toBe(false);
  });

  it('lists each value once and leaves out combinations that do not exist', () => {
    const wrapper = mountSelects({
      combinations: switchCombinations,
      modelValue: { Poler: '3P', Kapsling: 'IP65', Märkström: '16 A' },
    });
    const values = groupsOf(wrapper, 2).flatMap(([, v]) => v as string[]);
    expect(values).toEqual(['16 A', '25 A', '40 A', '63 A']);
  });

  it('shows the labels, not the raw values', () => {
    const wrapper = mountSelects({
      combinations: variantCombinations(twoDimensionTree),
      modelValue: { Gänga: 'm12', Längd: '60 mm' },
    });
    expect(groupsOf(wrapper, 0).flatMap(([, v]) => v as string[])).toEqual([
      'M12',
      'M10',
      'M8',
    ]);
  });

  it("shows each dimension's current label on its trigger, and asks to choose without one", () => {
    const wrapper = mountSelects({
      combinations: variantCombinations(twoDimensionTree),
      modelValue: { Gänga: 'm12' },
    });
    expect(
      wrapper.findAll('[data-testid="select-value"]').map((v) => v.text()),
    ).toEqual(['M12', 'product.select_variant_placeholder']);
  });

  it('emits a pick that changes exactly the dimensions its heading names', () => {
    const modelValue = { Poler: '3P', Kapsling: 'IP65', Märkström: '16 A' };
    const wrapper = mountSelects({
      combinations: switchCombinations,
      modelValue,
    });
    const select = wrapper.findAll('[data-testid="select"]')[2]!;
    const group = select
      .findAll('[data-testid^="variant-select-group-"]')
      .find((g) => g.find('[data-value="40 A"]').exists())!;
    expect(group.find('h4').text()).toBe('product.variant_group_more_changes');
    expect(group.attributes('data-testid')).toBe(
      'variant-select-group-Kapsling',
    );
    wrapper.findAllComponents(Select)[2]!.vm.$emit('update:modelValue', '40 A');
    const [[picked]] = wrapper.emitted('update:modelValue') as [
      [Record<string, string>],
    ];
    expect(
      Object.keys(picked).filter(
        (d) =>
          d !== 'Märkström' &&
          picked[d] !== modelValue[d as keyof typeof modelValue],
      ),
    ).toEqual(['Kapsling']);
  });

  it('caps every open list at one height, so a long one scrolls', () => {
    const wrapper = mountSelects({
      combinations: switchCombinations,
      modelValue: { Poler: '3P', Kapsling: 'IP65', Märkström: '16 A' },
    });
    for (const content of wrapper.findAll('[data-testid="select-content"]')) {
      expect(content.classes()).toContain('max-h-80');
    }
  });

  it('emits the whole selection of a matching pick', async () => {
    const wrapper = mountSelects();
    wrapper
      .findAllComponents(Select)[0]!
      .vm.$emit('update:modelValue', '1,5 kW');
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [{ Effekt: '1,5 kW', Spänning: '230 V' }],
    ]);
  });

  it('leads a "More options" pick to the closest variant, changing the other choice at once', async () => {
    const wrapper = mountSelects();
    wrapper
      .findAllComponents(Select)[0]!
      .vm.$emit('update:modelValue', '0,75 kW');
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [{ Effekt: '0,75 kW', Spänning: '400 V' }],
    ]);
  });

  it('ignores a pick of the current value', () => {
    const wrapper = mountSelects();
    wrapper
      .findAllComponents(Select)[0]!
      .vm.$emit('update:modelValue', '0,37 kW');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('disables every select while the page changes', () => {
    const wrapper = mountSelects({ disabled: true });
    expect(
      wrapper.findAllComponents(Select).map((s) => s.props('disabled')),
    ).toEqual([true, true]);
  });
});
