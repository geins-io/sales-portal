import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import QuantityStepper from '../../../app/components/shared/QuantityStepper.vue';

describe('QuantityStepper', () => {
  it('renders the current quantity value', () => {
    const wrapper = mountComponent(QuantityStepper, {
      props: { modelValue: 3 },
    });
    expect(wrapper.find('[data-testid="qty-value"]').text()).toBe('3');
  });

  it('emits updated value when increment is clicked', async () => {
    const wrapper = mountComponent(QuantityStepper, {
      props: { modelValue: 2 },
    });
    await wrapper.find('[data-testid="qty-increment"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([3]);
  });

  it('emits updated value when decrement is clicked', async () => {
    const wrapper = mountComponent(QuantityStepper, {
      props: { modelValue: 3 },
    });
    await wrapper.find('[data-testid="qty-decrement"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([2]);
  });

  it('does not decrement below default min of 1', async () => {
    const wrapper = mountComponent(QuantityStepper, {
      props: { modelValue: 1 },
    });
    const decrementBtn = wrapper.find('[data-testid="qty-decrement"]');
    expect(decrementBtn.attributes('disabled')).toBeDefined();
    await decrementBtn.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  it('does not decrement below custom min', async () => {
    const wrapper = mountComponent(QuantityStepper, {
      props: { modelValue: 5, min: 5 },
    });
    const decrementBtn = wrapper.find('[data-testid="qty-decrement"]');
    expect(decrementBtn.attributes('disabled')).toBeDefined();
    await decrementBtn.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  it('does not increment above max', async () => {
    const wrapper = mountComponent(QuantityStepper, {
      props: { modelValue: 10, max: 10 },
    });
    const incrementBtn = wrapper.find('[data-testid="qty-increment"]');
    expect(incrementBtn.attributes('disabled')).toBeDefined();
    await incrementBtn.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  it('disables both buttons when disabled prop is true', () => {
    const wrapper = mountComponent(QuantityStepper, {
      props: { modelValue: 3, disabled: true },
    });
    expect(
      wrapper.find('[data-testid="qty-decrement"]').attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper.find('[data-testid="qty-increment"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('enables decrement when value is above min', () => {
    const wrapper = mountComponent(QuantityStepper, {
      props: { modelValue: 2 },
    });
    const decrementBtn = wrapper.find('[data-testid="qty-decrement"]');
    expect(decrementBtn.attributes('disabled')).toBeUndefined();
  });
});
