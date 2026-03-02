import { describe, it, expect, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import ResetPasswordForm from '../../../app/components/auth/ResetPasswordForm.vue';
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
  Icon: true,
  NuxtIcon: true,
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
};

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders new password and confirm password fields', () => {
    const wrapper = mountComponent(ResetPasswordForm, {
      props: { resetKey: 'key123' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="reset-password"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="reset-confirm-password"]').exists(),
    ).toBe(true);
  });

  it('renders submit button', () => {
    const wrapper = mountComponent(ResetPasswordForm, {
      props: { resetKey: 'key123' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="reset-submit"]').exists()).toBe(true);
  });

  it('shows invalid key state when resetKey is empty', () => {
    const wrapper = mountComponent(ResetPasswordForm, {
      props: { resetKey: '' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="reset-invalid-key"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="reset-form"]').exists()).toBe(false);
  });

  it('disables submit button when loading', async () => {
    const wrapper = mountComponent(ResetPasswordForm, {
      props: { resetKey: 'key123' },
      global: { stubs },
    });
    const store = useAuthStore();
    store.isLoading = true;
    await wrapper.vm.$nextTick();
    const btn = wrapper.find('[data-testid="reset-submit"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('shows validation error on empty password after blur', async () => {
    const wrapper = mountComponent(ResetPasswordForm, {
      props: { resetKey: 'key123' },
      global: { stubs },
    });
    const passwordInput = wrapper.find('[data-testid="reset-password"]');
    await passwordInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="reset-password-error"]').exists()).toBe(
      true,
    );
  });

  it('displays store error message', async () => {
    const wrapper = mountComponent(ResetPasswordForm, {
      props: { resetKey: 'key123' },
      global: { stubs },
    });
    const store = useAuthStore();
    store.error = 'auth.reset_failed';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="reset-error"]').exists()).toBe(true);
  });

  it('renders form initially (not success state)', () => {
    const wrapper = mountComponent(ResetPasswordForm, {
      props: { resetKey: 'key123' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="reset-form"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="reset-success"]').exists()).toBe(false);
  });
});
