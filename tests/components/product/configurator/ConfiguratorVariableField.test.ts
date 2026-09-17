import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../../utils/component';
import ConfiguratorVariableField from '../../../../app/components/product/configurator/ConfiguratorVariableField.vue';
import type { ConfigurationVariable } from '#shared/types/configurator';
import {
  findVariable,
  makeBooleanVariableConfiguration,
  makeCabinetConfiguration,
  makeCascadedConfiguration,
  makeDateVariableConfiguration,
  makeInitialConfiguration,
} from '../../../fixtures/configurator';

function mountField(variable: ConfigurationVariable) {
  return mountComponent(ConfiguratorVariableField, { props: { variable } });
}

describe('ConfiguratorVariableField', () => {
  it('renders a number variable as a number field with its unit', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountField(findVariable(workbench, 'width'));

    expect(wrapper.attributes('data-control')).toBe('number');
    // The number field is a spinbutton whose displayed value is localised.
    expect(wrapper.find('input').attributes('aria-valuenow')).toBe('1200');
    expect(wrapper.text()).toContain('mm');
  });

  it('renders a string variable as a text field', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountField(findVariable(cabinet, 'pallet-code'));

    expect(wrapper.attributes('data-control')).toBe('text');
    expect(wrapper.find('input').element.value).toBe('PAL-80');
  });

  it('renders a boolean variable as a switch', () => {
    const derived = makeBooleanVariableConfiguration();

    const wrapper = mountField(findVariable(derived, 'shelves'));

    expect(wrapper.attributes('data-control')).toBe('boolean');
    expect(wrapper.find('[role="switch"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('configurator.no');
  });

  it('renders a date variable, cut down to what a date input takes', () => {
    const derived = makeDateVariableConfiguration();

    const wrapper = mountField(findVariable(derived, 'shelves'));

    expect(wrapper.attributes('data-control')).toBe('date');
    const input = wrapper.find('input');
    expect(input.attributes('type')).toBe('date');
    expect(input.element.value).toBe('2026-09-17');
  });

  it('shows the bounds the provider narrowed', () => {
    const cascaded = makeCascadedConfiguration();

    const wrapper = mountField(findVariable(cascaded, 'width'));

    expect(wrapper.find('[data-testid="configurator-bounds"]').text()).toBe(
      'configurator.bounds',
    );
    expect(wrapper.find('input').attributes('aria-valuemax')).toBe('1600');
  });

  it('disables a variable the provider owns and says why', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountField(findVariable(cabinet, 'front-area'));

    const input = wrapper.find('input');
    expect(input.attributes('disabled')).toBeDefined();
    expect(wrapper.find('[title]').attributes('title')).toBe(
      'configurator.read_only',
    );
  });

  it('marks a required variable', () => {
    const workbench = makeInitialConfiguration();

    const required = mountField(findVariable(workbench, 'width'));
    const optional = mountField(findVariable(workbench, 'shelves'));

    expect(required.text()).toContain('configurator.required');
    expect(optional.text()).not.toContain('configurator.required');
  });

  it('does not emit while the buyer is typing', async () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountField(findVariable(cabinet, 'pallet-code'));
    await wrapper.find('input').setValue('PAL-120');

    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('emits the text field on blur', async () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountField(findVariable(cabinet, 'pallet-code'));
    const input = wrapper.find('input');
    await input.setValue('PAL-120');
    await input.trigger('blur');

    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({
      type: 'variable',
      variableId: 'pallet-code',
      value: 'PAL-120',
    });
  });

  it('emits the number field on enter', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountField(findVariable(workbench, 'width'));
    const input = wrapper.find('input');
    await input.setValue('1500');
    await input.trigger('keydown.enter');

    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({
      type: 'variable',
      variableId: 'width',
      value: 1500,
    });
  });

  it('emits nothing when the field is left holding what the document holds', async () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountField(findVariable(workbench, 'width'));
    await wrapper.find('input').trigger('blur');

    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('emits a switch as it is flipped', async () => {
    const derived = makeBooleanVariableConfiguration();

    const wrapper = mountField(findVariable(derived, 'shelves'));
    await wrapper.find('[role="switch"]').trigger('click');

    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({
      type: 'variable',
      variableId: 'shelves',
      value: true,
    });
  });

  it('emits a date as it is set, and null when it is cleared', async () => {
    const derived = makeDateVariableConfiguration();

    const wrapper = mountField(findVariable(derived, 'shelves'));
    const input = wrapper.find('input');
    // Setting a date input fires its change event; a date is committed whole,
    // never a character at a time.
    await input.setValue('2026-12-24');
    await input.setValue('');

    expect(wrapper.emitted('change')).toHaveLength(2);
    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({
      type: 'variable',
      variableId: 'shelves',
      value: '2026-12-24',
    });
    expect(wrapper.emitted('change')?.[1]?.[0]).toEqual({
      type: 'variable',
      variableId: 'shelves',
      value: null,
    });
  });

  it('emits nothing from a variable the provider owns', async () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountField(findVariable(cabinet, 'front-area'));
    const input = wrapper.find('input');
    await input.setValue('99');
    await input.trigger('blur');

    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('takes a new document over an unsent draft', async () => {
    const cabinet = makeCabinetConfiguration();
    const variable = findVariable(cabinet, 'pallet-code');

    const wrapper = mountField(variable);
    await wrapper.find('input').setValue('PAL-120');

    // The whole document is replaced on every change, so a value that comes
    // back from the provider wins over whatever was half-typed.
    await wrapper.setProps({ variable: { ...variable, value: 'PAL-200' } });

    expect(wrapper.find('input').element.value).toBe('PAL-200');
  });

  // ---------------------------------------------------------------------
  // The range a rule narrowed
  // ---------------------------------------------------------------------
  it('says nothing about a range that is the one it started with', () => {
    const workbench = makeInitialConfiguration();

    const wrapper = mountField(findVariable(workbench, 'width'));

    expect(
      wrapper.find('[data-testid="configurator-bounds-narrowed"]').exists(),
    ).toBe(false);
  });

  it('marks the range a later document narrowed', async () => {
    const workbench = makeInitialConfiguration();
    const cascaded = makeCascadedConfiguration();

    // The same field, given the document that comes back once a steel top
    // caps the width — which is the only way the narrowing is observable: the
    // document carries the range that holds now and never the one before it.
    const wrapper = mountField(findVariable(workbench, 'width'));
    await wrapper.setProps({ variable: findVariable(cascaded, 'width') });

    expect(
      wrapper.find('[data-testid="configurator-bounds-narrowed"]').text(),
    ).toBe('· configurator.bounds_narrowed');
    expect(
      wrapper.find('[data-testid="configurator-bounds"]').text(),
    ).toContain('configurator.bounds');
  });

  it('says nothing when a later document leaves the range alone', async () => {
    const workbench = makeInitialConfiguration();
    const again = makeInitialConfiguration();

    const wrapper = mountField(findVariable(workbench, 'width'));
    await wrapper.setProps({ variable: findVariable(again, 'width') });

    expect(
      wrapper.find('[data-testid="configurator-bounds-narrowed"]').exists(),
    ).toBe(false);
  });

  it('starts from the range it is first given, not from the widest seen', async () => {
    const workbench = makeInitialConfiguration();
    const cascaded = makeCascadedConfiguration();

    // A field mounted on an already-narrowed document has nothing to compare
    // against and says nothing, even once the cap is lifted again.
    const wrapper = mountField(findVariable(cascaded, 'width'));
    await wrapper.setProps({ variable: findVariable(workbench, 'width') });

    expect(
      wrapper.find('[data-testid="configurator-bounds-narrowed"]').exists(),
    ).toBe(false);
  });
});
