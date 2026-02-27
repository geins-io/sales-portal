import { describe, it, expect, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import RegisterForm from '../../../app/components/auth/RegisterForm.vue';
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
    props: ['type', 'disabled'],
  },
};

describe('RegisterForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders all configured form fields', () => {
    const wrapper = mountComponent(RegisterForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="register-email"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="register-password"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="register-firstName"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="register-lastName"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="register-company"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="register-phone"]').exists()).toBe(true);
  });

  it('renders submit button', () => {
    const wrapper = mountComponent(RegisterForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="register-submit"]').exists()).toBe(true);
  });

  it('disables submit button when loading', async () => {
    const wrapper = mountComponent(RegisterForm, { global: { stubs } });
    const store = useAuthStore();
    store.isLoading = true;
    await wrapper.vm.$nextTick();
    const btn = wrapper.find('[data-testid="register-submit"]');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('displays error message from store', async () => {
    const wrapper = mountComponent(RegisterForm, { global: { stubs } });
    const store = useAuthStore();
    store.error = 'auth.register_failed';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="register-error"]').exists()).toBe(true);
  });
});
