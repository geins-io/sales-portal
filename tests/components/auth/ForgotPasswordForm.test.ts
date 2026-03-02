import { describe, it, expect, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import ForgotPasswordForm from '../../../app/components/auth/ForgotPasswordForm.vue';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../../../app/stores/auth';

const stubs = {
  Label: { template: '<label><slot /></label>', props: ['for'] },
  Input: {
    template:
      '<input :type="type" :id="id" v-bind="$attrs" @blur="$emit(\'blur\', $event)" />',
    props: [
      'type',
      'id',
      'modelValue',
      'placeholder',
      'autocomplete',
      'disabled',
    ],
    emits: ['update:modelValue', 'blur'],
  },
  Button: {
    template: '<button :type="type" :disabled="disabled"><slot /></button>',
    props: ['type', 'disabled', 'variant'],
  },
};

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders email field', () => {
    const wrapper = mountComponent(ForgotPasswordForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="forgot-email"]').exists()).toBe(true);
  });

  it('renders submit button', () => {
    const wrapper = mountComponent(ForgotPasswordForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="forgot-submit"]').exists()).toBe(true);
  });

  it('disables submit button when loading', async () => {
    const wrapper = mountComponent(ForgotPasswordForm, { global: { stubs } });
    const store = useAuthStore();
    store.isLoading = true;
    await wrapper.vm.$nextTick();
    const btn = wrapper.find('[data-testid="forgot-submit"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('shows validation error on empty email after blur', async () => {
    const wrapper = mountComponent(ForgotPasswordForm, { global: { stubs } });
    const emailInput = wrapper.find('[data-testid="forgot-email"]');
    await emailInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="forgot-email-error"]').exists()).toBe(
      true,
    );
  });

  it('does not show validation error before blur', () => {
    const wrapper = mountComponent(ForgotPasswordForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="forgot-email-error"]').exists()).toBe(
      false,
    );
  });

  it('renders forgot form initially (not success)', () => {
    const wrapper = mountComponent(ForgotPasswordForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="forgot-form"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="forgot-success"]').exists()).toBe(false);
  });
});
