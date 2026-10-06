import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import QuantityInput from '../../../app/components/shared/QuantityInput.vue';

const numberFieldStubs = {
  NumberField: {
    template:
      '<div class="number-field"><slot :modelValue="modelValue" /></div>',
    props: ['modelValue', 'min', 'max', 'step'],
  },
  UiNumberField: {
    template:
      '<div class="number-field"><slot :modelValue="modelValue" /></div>',
    props: ['modelValue', 'min', 'max', 'step'],
  },
  NumberFieldContent: { template: '<div><slot /></div>' },
  UiNumberFieldContent: { template: '<div><slot /></div>' },
  NumberFieldDecrement: {
    template: '<button class="decrement"><slot /></button>',
  },
  UiNumberFieldDecrement: {
    template: '<button class="decrement"><slot /></button>',
  },
  NumberFieldIncrement: {
    template: '<button class="increment"><slot /></button>',
  },
  UiNumberFieldIncrement: {
    template: '<button class="increment"><slot /></button>',
  },
  NumberFieldInput: { template: '<input class="qty-input" />' },
  UiNumberFieldInput: { template: '<input class="qty-input" />' },
};

describe('QuantityInput', () => {
  it('renders number field with controls', () => {
    const wrapper = mountComponent(QuantityInput, {
      props: { modelValue: 1 },
      global: { stubs: numberFieldStubs },
    });
    expect(wrapper.find('.number-field').exists()).toBe(true);
    expect(wrapper.find('.decrement').exists()).toBe(true);
    expect(wrapper.find('.increment').exists()).toBe(true);
    expect(wrapper.find('.qty-input').exists()).toBe(true);
  });

  it('passes min and max to NumberField', () => {
    const wrapper = mountComponent(QuantityInput, {
      props: { modelValue: 2, min: 1, max: 10, step: 1 },
      global: { stubs: numberFieldStubs },
    });
    expect(wrapper.find('.number-field').exists()).toBe(true);
  });

  it('defaults min to 1 and step to 1', () => {
    const wrapper = mountComponent(QuantityInput, {
      props: { modelValue: 1 },
      global: { stubs: numberFieldStubs },
    });
    expect(wrapper.find('.number-field').exists()).toBe(true);
  });
});

// The real field, not the stubs: the blur that re-applies the input's value is
// reka-ui's own behaviour.
describe('QuantityInput with the real number field', () => {
  // A step leaves the focus in the field, so the next press anywhere blurs it
  // with the value the parent already holds.
  it('emits nothing when the field loses focus with its value unchanged', async () => {
    const wrapper = mountComponent(QuantityInput, {
      props: { modelValue: 2 },
      attachTo: document.body,
    });

    await wrapper.find('input').trigger('blur');

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });

  it('still emits a value typed into the field when it loses focus', async () => {
    const wrapper = mountComponent(QuantityInput, {
      props: { modelValue: 1 },
      attachTo: document.body,
    });
    const input = wrapper.find('input');
    await input.setValue('3');
    await input.trigger('blur');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([3]);
    wrapper.unmount();
  });
});
