import { describe, it, expect, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import LoginForm from '../../../app/components/auth/LoginForm.vue';
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
  Checkbox: {
    template:
      '<button role="checkbox" :aria-checked="modelValue" :disabled="disabled" v-bind="$attrs" @click="$emit(\'update:modelValue\', !modelValue)" />',
    props: ['modelValue', 'disabled', 'id'],
    emits: ['update:modelValue'],
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

  it('shows validation error on empty email after blur', async () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    const emailInput = wrapper.find('[data-testid="login-email"]');
    await emailInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="login-email-error"]').exists()).toBe(
      true,
    );
  });

  it('shows validation error on empty password after blur', async () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    const passwordInput = wrapper.find('[data-testid="login-password"]');
    await passwordInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="login-password-error"]').exists()).toBe(
      true,
    );
  });

  it('emits forgot event when forgot password link is clicked', async () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    const forgotLink = wrapper.find('[data-testid="login-forgot-password"]');
    await forgotLink.trigger('click');
    expect(wrapper.emitted('forgot')).toBeTruthy();
  });

  it('renders remember-me checkbox', () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="login-remember-me"]').exists()).toBe(
      true,
    );
  });

  it('remember-me checkbox is checked by default', () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    const checkbox = wrapper.find('[data-testid="login-remember-me"]');
    expect(checkbox.attributes('aria-checked')).toBe('true');
  });

  it('disables remember-me checkbox when loading', async () => {
    const wrapper = mountComponent(LoginForm, { global: { stubs } });
    const store = useAuthStore();
    store.isLoading = true;
    await wrapper.vm.$nextTick();
    const checkbox = wrapper.find('[data-testid="login-remember-me"]');
    expect(checkbox.attributes('disabled')).toBeDefined();
  });

  it('passes rememberMe true to store when checkbox is checked', async () => {
    const store = useAuthStore();
    const loginSpy = vi.spyOn(store, 'login').mockResolvedValue({} as never);
    const wrapper = mountComponent(LoginForm, { global: { stubs } });

    // Set email/password via the stub's update:modelValue events
    const emailInput = wrapper.findComponent('[data-testid="login-email"]');
    const passwordInput = wrapper.findComponent(
      '[data-testid="login-password"]',
    );
    emailInput.vm.$emit('update:modelValue', 'user@example.com');
    passwordInput.vm.$emit('update:modelValue', 'password123');
    await wrapper.vm.$nextTick();

    await wrapper.find('form').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(loginSpy).toHaveBeenCalledWith(
      expect.objectContaining({ rememberMe: true }),
    );
  });

  it('passes rememberMe false to store when checkbox is unchecked', async () => {
    const store = useAuthStore();
    const loginSpy = vi.spyOn(store, 'login').mockResolvedValue({} as never);
    const wrapper = mountComponent(LoginForm, { global: { stubs } });

    // Uncheck the checkbox via update:modelValue
    const checkbox = wrapper.findComponent('[data-testid="login-remember-me"]');
    checkbox.vm.$emit('update:modelValue', false);
    await wrapper.vm.$nextTick();

    // Set email/password
    const emailInput = wrapper.findComponent('[data-testid="login-email"]');
    const passwordInput = wrapper.findComponent(
      '[data-testid="login-password"]',
    );
    emailInput.vm.$emit('update:modelValue', 'user@example.com');
    passwordInput.vm.$emit('update:modelValue', 'password123');
    await wrapper.vm.$nextTick();

    await wrapper.find('form').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(loginSpy).toHaveBeenCalledWith(
      expect.objectContaining({ rememberMe: false }),
    );
  });
});
