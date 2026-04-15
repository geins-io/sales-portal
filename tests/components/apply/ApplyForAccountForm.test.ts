import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountComponent } from '../../utils/component';
import ApplyForAccountForm from '../../../app/components/apply/ApplyForAccountForm.vue';

const stubs = {
  Label: { template: '<label><slot /></label>', props: ['for'] },
  Input: {
    template:
      '<input :type="type" :id="id" :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" />',
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
    props: ['type', 'disabled'],
  },
};

// Mock $fetch globally for form submission
vi.stubGlobal('$fetch', vi.fn());

describe('ApplyForAccountForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="apply-company-name"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="apply-org-number"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="apply-first-name"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="apply-last-name"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="apply-email"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="apply-phone"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="apply-message"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="apply-submit"]').exists()).toBe(true);
  });

  it('shows validation error on empty required field after blur', async () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    const nameInput = wrapper.find('[data-testid="apply-company-name"]');
    await nameInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(
      wrapper.find('[data-testid="apply-company-name-error"]').exists(),
    ).toBe(true);
  });

  it('shows validation error for invalid email after blur', async () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    const emailInput = wrapper.find('[data-testid="apply-email"]');
    await emailInput.setValue('not-an-email');
    await emailInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="apply-email-error"]').exists()).toBe(
      true,
    );
  });

  it('does not show success state initially', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="apply-success"]').exists()).toBe(false);
  });

  it('renders the form element with submit handler', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="apply-form"]').exists()).toBe(true);
  });

  it('does not show error message initially', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="apply-error"]').exists()).toBe(false);
  });

  it('renders confirmation message after successful submit', async () => {
    (globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = vi
      .fn()
      .mockResolvedValue({ ok: true });

    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });

    await wrapper
      .find('[data-testid="apply-company-name"]')
      .setValue('Acme AB');
    await wrapper.find('[data-testid="apply-org-number"]').setValue('556677');
    await wrapper.find('[data-testid="apply-first-name"]').setValue('Ada');
    await wrapper.find('[data-testid="apply-last-name"]').setValue('Lovelace');
    await wrapper
      .find('[data-testid="apply-email"]')
      .setValue('ada@example.com');

    await wrapper.find('[data-testid="apply-form"]').trigger('submit');
    await flushPromises();

    const success = wrapper.find('[data-testid="apply-success"]');
    expect(success.exists()).toBe(true);
    expect(success.text()).toContain('apply.confirmation_message');
    expect(success.text()).not.toContain('apply.success_message');
  });

  it('does not reference the removed apply.success_message key', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.html()).not.toContain('apply.success_message');
  });
});
