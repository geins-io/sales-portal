import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../utils/component';
import ChangePasswordForm from '../../../app/components/portal/ChangePasswordForm.vue';

vi.stubGlobal(
  '$fetch',
  vi.fn(() => Promise.resolve({ success: true })),
);

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

describe('ChangePasswordForm', () => {
  it('renders form with data-testid', () => {
    const wrapper = mountComponent(ChangePasswordForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="change-password-form"]').exists()).toBe(
      true,
    );
  });

  it('renders current password field', () => {
    const wrapper = mountComponent(ChangePasswordForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="password-current"]').exists()).toBe(
      true,
    );
  });

  it('renders new password field', () => {
    const wrapper = mountComponent(ChangePasswordForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="password-new"]').exists()).toBe(true);
  });

  it('renders confirm password field', () => {
    const wrapper = mountComponent(ChangePasswordForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="password-confirm"]').exists()).toBe(
      true,
    );
  });

  it('renders submit button', () => {
    const wrapper = mountComponent(ChangePasswordForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="password-submit"]').exists()).toBe(true);
  });

  it('shows validation error on blur with empty current password', async () => {
    const wrapper = mountComponent(ChangePasswordForm, { global: { stubs } });
    await wrapper.find('[data-testid="password-current"]').trigger('blur');
    await wrapper.vm.$nextTick();
    expect(
      wrapper.find('[data-testid="password-current-error"]').exists(),
    ).toBe(true);
  });

  it('shows mismatch error when passwords differ', async () => {
    const wrapper = mountComponent(ChangePasswordForm, { global: { stubs } });
    await wrapper.find('[data-testid="password-confirm"]').trigger('blur');
    await wrapper.vm.$nextTick();
    expect(
      wrapper.find('[data-testid="password-confirm-error"]').exists(),
    ).toBe(true);
  });
});
