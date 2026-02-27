import { describe, it, expect, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import LoginForm from '../../../app/components/auth/LoginForm.vue';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../../../app/stores/auth';

const stubs = {
  Label: { template: '<label><slot /></label>', props: ['for'] },
  Input: {
    template: '<input :type="type" :id="id" v-bind="$attrs" />',
    props: [
      'type',
      'id',
      'modelValue',
      'placeholder',
      'required',
      'autocomplete',
      'disabled',
    ],
    emits: ['update:modelValue'],
  },
  Button: {
    template: '<button :type="type" :disabled="disabled"><slot /></button>',
    props: ['type', 'disabled', 'variant'],
  },
};

describe('LoginForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders email and password fields', () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="login-email"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-password"]').exists()).toBe(true);
  });

  it('renders submit button', () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="login-submit"]').exists()).toBe(true);
  });

  it('renders forgot password link', () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="login-forgot-password"]').exists()).toBe(
      true,
    );
  });

  it('disables submit button when loading', async () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    const store = useAuthStore();
    store.isLoading = true;
    await wrapper.vm.$nextTick();
    const btn = wrapper.find('[data-testid="login-submit"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('displays error message from store', async () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    const store = useAuthStore();
    store.error = 'auth.login_failed';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="login-error"]').exists()).toBe(true);
  });

  it('does not display error when no error', () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="login-error"]').exists()).toBe(false);
  });
});
