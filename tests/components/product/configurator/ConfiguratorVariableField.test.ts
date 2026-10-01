import { describe, it, expect } from 'vitest';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
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

const SET_AUTOMATICALLY = '[data-testid="configurator-set-automatically"]';

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

  it('disables a variable the provider owns and says it is set automatically', () => {
    const cabinet = makeCabinetConfiguration();

    const wrapper = mountField(findVariable(cabinet, 'front-area'));

    const input = wrapper.find('input');
    expect(input.attributes('disabled')).toBeDefined();
    expect(wrapper.find(SET_AUTOMATICALLY).text()).toBe(
      'configurator.set_automatically',
    );
    expect(wrapper.find('[title]').exists()).toBe(false);
  });

  describe('a read-only variable of each control', () => {
    const cases: [string, () => ConfigurationVariable][] = [
      ['number', () => findVariable(makeInitialConfiguration(), 'width')],
      ['text', () => findVariable(makeCabinetConfiguration(), 'pallet-code')],
      [
        'boolean',
        () => findVariable(makeBooleanVariableConfiguration(), 'shelves'),
      ],
      ['date', () => findVariable(makeDateVariableConfiguration(), 'shelves')],
    ];

    for (const [control, make] of cases) {
      it(`says a ${control} field is set automatically, with no asterisk and no tooltip`, () => {
        const variable = { ...make(), readOnly: true, required: true };

        const wrapper = mountField(variable);

        expect(wrapper.attributes('data-control')).toBe(control);
        expect(wrapper.find(SET_AUTOMATICALLY).text()).toBe(
          'configurator.set_automatically',
        );
        expect(wrapper.text()).not.toContain('configurator.required');
        expect(wrapper.text()).not.toContain('*');
        expect(wrapper.find('[title]').exists()).toBe(false);
      });
    }

    it('says the same of a value a rule locked', () => {
      const variable = {
        ...findVariable(makeInitialConfiguration(), 'width'),
        selectionSource: 'temporarilyLocked' as const,
      };

      const wrapper = mountField(variable);

      expect(wrapper.find(SET_AUTOMATICALLY).exists()).toBe(true);
      expect(wrapper.text()).not.toContain('configurator.required');
    });

    it('says nothing of the kind on a field the buyer fills in', () => {
      const wrapper = mountField(
        findVariable(makeInitialConfiguration(), 'width'),
      );

      expect(wrapper.find(SET_AUTOMATICALLY).exists()).toBe(false);
      expect(wrapper.text()).toContain('configurator.required');
    });

    it('says nothing of the kind, and shows no tooltip, while a batch is in flight', () => {
      const wrapper = mountComponent(ConfiguratorVariableField, {
        props: {
          variable: findVariable(makeInitialConfiguration(), 'width'),
          disabled: true,
        },
      });

      expect(wrapper.find(SET_AUTOMATICALLY).exists()).toBe(false);
      expect(wrapper.find('[title]').exists()).toBe(false);
    });
  });

  it('marks a required variable', () => {
    const workbench = makeInitialConfiguration();

    const required = mountField(findVariable(workbench, 'width'));
    const optional = mountField(findVariable(workbench, 'shelves'));

    expect(required.text()).toContain('configurator.required');
    expect(optional.text()).not.toContain('configurator.required');
  });

  it('does not mark a required variable the provider made unavailable', () => {
    const width = {
      ...findVariable(makeInitialConfiguration(), 'width'),
      available: false,
    };

    const wrapper = mountField(width);

    expect(wrapper.text()).not.toContain('configurator.required');
    expect(wrapper.text()).not.toContain('*');
  });

  it('does not call a field the provider made unavailable "set by the configuration"', () => {
    const width = {
      ...findVariable(makeInitialConfiguration(), 'width'),
      available: false,
    };

    const wrapper = mountField(width);

    expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[title]').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('configurator.read_only');
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
  // A number the provider has not set (1359's required "Machine weight")
  // ---------------------------------------------------------------------
  function unsetNumber(): ConfigurationVariable {
    return {
      ...findVariable(makeInitialConfiguration(), 'width'),
      value: null,
    };
  }

  it('renders an unset number as an empty field, not as 0', () => {
    const wrapper = mountField(unsetNumber());

    const input = wrapper.find('input');
    expect(input.element.value).toBe('');
    expect(input.attributes('aria-valuenow')).toBeUndefined();
  });

  it('emits a value typed into an unset number', async () => {
    const wrapper = mountField(unsetNumber());
    const input = wrapper.find('input');
    await input.setValue('1500');
    await input.trigger('keydown.enter');

    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({
      type: 'variable',
      variableId: 'width',
      value: 1500,
    });
  });

  it('shows the document again after a batch that failed and left it unchanged', async () => {
    const wrapper = mountComponent(ConfiguratorVariableField, {
      props: { variable: unsetNumber(), disabled: false },
    });
    const input = wrapper.find('input');
    await input.setValue('1500');
    await input.trigger('keydown.enter');
    expect(wrapper.emitted('change')).toHaveLength(1);

    // The page locks every field while the batch is in flight. It fails, so
    // the same document stays on screen and no value watch can fire.
    await wrapper.setProps({ disabled: true });
    await wrapper.setProps({ disabled: false });

    expect(wrapper.find('input').element.value).toBe('');
  });

  it('shows the document again after a failed text change too', async () => {
    const variable = findVariable(makeCabinetConfiguration(), 'pallet-code');
    const wrapper = mountComponent(ConfiguratorVariableField, {
      props: { variable, disabled: false },
    });
    const input = wrapper.find('input');
    await input.setValue('PAL-120');
    await input.trigger('blur');

    await wrapper.setProps({ disabled: true });
    await wrapper.setProps({ disabled: false });

    expect(wrapper.find('input').element.value).toBe('PAL-80');
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

  it('treats a read-only variable as one the provider owns', async () => {
    const workbench = makeInitialConfiguration();
    const variable = findVariable(workbench, 'width');
    variable.readOnly = true;

    const wrapper = mountField(variable);
    const input = wrapper.find('input');
    expect(input.attributes('disabled')).toBeDefined();
    expect(wrapper.find(SET_AUTOMATICALLY).exists()).toBe(true);

    await input.setValue('1500');
    await input.trigger('blur');
    expect(wrapper.emitted('change')).toBeUndefined();
  });

  // -------------------------------------------------------------------
  // The stepper from an empty field
  // -------------------------------------------------------------------

  /** A width with nothing set and no range, as "Max transport time" arrives. */
  function openNumber(
    over: Partial<ConfigurationVariable> = {},
  ): ConfigurationVariable {
    return {
      ...findVariable(makeInitialConfiguration(), 'width'),
      value: null,
      min: undefined,
      max: undefined,
      step: undefined,
      ...over,
    };
  }

  /**
   * A press as a pointer makes it: down on the button, up anywhere, click. The
   * down is a real `PointerEvent`, because the stepper ignores any press whose
   * `button` is not 0 and `trigger` does not carry one.
   */
  async function press(wrapper: VueWrapper, label: 'Increase' | 'Decrease') {
    // The stepper listens once it has found its element, a tick after mount.
    await flushPromises();
    const button = wrapper.find(`button[aria-label="${label}"]`);
    button.element.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, bubbles: true }),
    );
    window.dispatchEvent(new Event('pointerup'));
    await button.trigger('click');
    await flushPromises();
  }

  it('steps an empty field up from zero by one, not to zero', async () => {
    const wrapper = mountField(openNumber());

    await press(wrapper, 'Increase');

    expect(wrapper.emitted('change')).toEqual([
      [{ type: 'variable', variableId: 'width', value: 1 }],
    ]);
  });

  it('steps an empty field up by its own step', async () => {
    const wrapper = mountField(openNumber({ step: 0.5, decimals: 1 }));

    await press(wrapper, 'Increase');

    expect(wrapper.emitted('change')).toEqual([
      [{ type: 'variable', variableId: 'width', value: 0.5 }],
    ]);
  });

  it('steps an empty field down from zero when negatives are allowed', async () => {
    const wrapper = mountField(openNumber());

    await press(wrapper, 'Decrease');

    expect(wrapper.emitted('change')).toEqual([
      [{ type: 'variable', variableId: 'width', value: -1 }],
    ]);
  });

  it('steps an empty field up to a floor above the first step', async () => {
    const wrapper = mountField(openNumber({ min: 800, step: 100 }));

    await press(wrapper, 'Increase');

    expect(wrapper.emitted('change')).toEqual([
      [{ type: 'variable', variableId: 'width', value: 800 }],
    ]);
  });

  it('steps an empty field with a floor of zero up to the first step', async () => {
    const wrapper = mountField(openNumber({ min: 0 }));

    await press(wrapper, 'Increase');

    expect(wrapper.emitted('change')).toEqual([
      [{ type: 'variable', variableId: 'width', value: 1 }],
    ]);
  });

  it('disables a step down from an empty field that the floor rules out', async () => {
    const wrapper = mountField(openNumber({ min: 0 }));

    const down = wrapper.find('button[aria-label="Decrease"]');
    expect(down.attributes('disabled')).toBeDefined();
    expect(
      wrapper.find('button[aria-label="Increase"]').attributes('disabled'),
    ).toBeUndefined();

    await press(wrapper, 'Decrease');
    expect(wrapper.emitted('change')).toBeUndefined();
    expect(wrapper.find('input').element.value).toBe('');
  });

  it('disables a step up from an empty field that the ceiling rules out', () => {
    const wrapper = mountField(openNumber({ max: 0 }));

    expect(
      wrapper.find('button[aria-label="Increase"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('keeps a typed value after a press the stepper did not act on', async () => {
    // Locked while a batch is in flight: the press reaches the button, the
    // stepper ignores it, and no step follows to use it up.
    const wrapper = mountComponent(ConfiguratorVariableField, {
      props: { variable: openNumber(), disabled: true },
    });
    await flushPromises();
    wrapper
      .find('button[aria-label="Increase"]')
      .element.dispatchEvent(
        new PointerEvent('pointerdown', { button: 0, bubbles: true }),
      );
    window.dispatchEvent(new Event('pointerup'));
    // Typing is a later task than the press, never the same one.
    await new Promise((resolve) => setTimeout(resolve));
    await wrapper.setProps({ disabled: false });

    const input = wrapper.find('input');
    await input.setValue('5');
    await input.trigger('keydown.enter');

    expect(wrapper.emitted('change')).toEqual([
      [{ type: 'variable', variableId: 'width', value: 5 }],
    ]);
  });

  it('steps a set value by its step as before', async () => {
    const wrapper = mountField(
      findVariable(makeInitialConfiguration(), 'width'),
    );

    await press(wrapper, 'Increase');

    expect(wrapper.emitted('change')).toEqual([
      [{ type: 'variable', variableId: 'width', value: 1300 }],
    ]);
  });

  // -------------------------------------------------------------------
  // A refused change
  // -------------------------------------------------------------------

  it('says the value was not accepted when its change was refused', () => {
    const wrapper = mountComponent(ConfiguratorVariableField, {
      props: { variable: openNumber(), refused: true },
    });

    expect(
      wrapper.find('[data-testid="configurator-change-refused"]').text(),
    ).toBe('configurator.change_refused_value');
  });

  it('says nothing about a refusal that was not its own', () => {
    const wrapper = mountField(openNumber());

    expect(
      wrapper.find('[data-testid="configurator-change-refused"]').exists(),
    ).toBe(false);
  });
});
