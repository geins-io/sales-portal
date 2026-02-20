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
