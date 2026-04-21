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
  Select: { template: '<div data-stub="select"><slot /></div>' },
  SelectTrigger: {
    template:
      '<button type="button" data-stub="select-trigger" v-bind="$attrs"><slot /></button>',
  },
  SelectValue: {
    template: '<span data-stub="select-value"><slot /></span>',
    props: ['placeholder'],
  },
  SelectContent: { template: '<div data-stub="select-content"><slot /></div>' },
  SelectItem: {
    template: '<div data-stub="select-item" :data-value="value"><slot /></div>',
    props: ['value'],
  },
  Checkbox: {
    template:
      '<input type="checkbox" data-stub="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" v-bind="$attrs" />',
    props: ['checked', 'id', 'disabled'],
    emits: ['update:checked'],
  },
  NuxtLink: {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
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

    // Fill in new required fields via reactive data
    const vm = wrapper.vm as unknown as {
      formData: { country: string; password: string; acceptTerms: boolean };
    };
    vm.formData.country = 'SE';
    vm.formData.password = 'secret123';
    vm.formData.acceptTerms = true;
    await wrapper.vm.$nextTick();

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

  // --- New tests for Figma alignment ---

  it('renders country select', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="apply-country"]').exists()).toBe(true);
  });

  it('renders 6 country options', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    const options = wrapper.findAll('[data-testid="apply-country-option"]');
    expect(options).toHaveLength(6);
    const values = options.map((o) => o.attributes('data-value'));
    expect(values).toEqual(['SE', 'NO', 'DK', 'FI', 'DE', 'GB']);
  });

  it('renders password input', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="apply-password"]').exists()).toBe(true);
  });

  it('renders password show/hide toggle', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="apply-password-toggle"]').exists()).toBe(
      true,
    );
  });

  it('renders terms checkbox', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="apply-terms"]').exists()).toBe(true);
  });

  it('renders terms link', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="apply-terms-link"]').exists()).toBe(
      true,
    );
  });

  it('wraps submit button in flex justify-end container', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    const submitBtn = wrapper.find('[data-testid="apply-submit"]');
    const parent = submitBtn.element.parentElement;
    expect(parent?.className).toContain('flex');
    expect(parent?.className).toContain('justify-end');
  });

  it('submit button does not have w-full class', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    const submitBtn = wrapper.find('[data-testid="apply-submit"]');
    expect(submitBtn.classes()).not.toContain('w-full');
  });

  it('shows country required error when country not selected on submit', async () => {
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

    const vm = wrapper.vm as unknown as {
      formData: { password: string; acceptTerms: boolean };
    };
    vm.formData.password = 'secret123';
    vm.formData.acceptTerms = true;
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="apply-form"]').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="apply-country-error"]').exists()).toBe(
      true,
    );
  });

  it('shows password min length error when password is too short on submit', async () => {
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

    const vm = wrapper.vm as unknown as {
      formData: { country: string; password: string; acceptTerms: boolean };
    };
    vm.formData.country = 'SE';
    vm.formData.password = 'short';
    vm.formData.acceptTerms = true;
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="apply-form"]').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="apply-password-error"]').exists()).toBe(
      true,
    );
  });

  it('shows terms required error when terms not accepted on submit', async () => {
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

    const vm = wrapper.vm as unknown as {
      formData: { country: string; password: string };
    };
    vm.formData.country = 'SE';
    vm.formData.password = 'secret123';
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="apply-form"]').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="apply-terms-error"]').exists()).toBe(
      true,
    );
  });

  it('renders fields in correct DOM order', () => {
    const wrapper = mountComponent(ApplyForAccountForm, { global: { stubs } });
    const form = wrapper.find('[data-testid="apply-form"]');
    const html = form.html();

    const companyIdx = html.indexOf('apply-company-name');
    const firstNameIdx = html.indexOf('apply-first-name');
    const countryIdx = html.indexOf('apply-country');
    const emailIdx = html.indexOf('apply-email');
    const passwordIdx = html.indexOf('apply-password"');
    const termsIdx = html.indexOf('apply-terms"');
    const phoneIdx = html.indexOf('apply-phone');
    const submitIdx = html.indexOf('apply-submit');

    expect(companyIdx).toBeLessThan(firstNameIdx);
    expect(firstNameIdx).toBeLessThan(countryIdx);
    expect(countryIdx).toBeLessThan(emailIdx);
    expect(emailIdx).toBeLessThan(passwordIdx);
    expect(passwordIdx).toBeLessThan(termsIdx);
    expect(termsIdx).toBeLessThan(phoneIdx);
    expect(phoneIdx).toBeLessThan(submitIdx);
  });
});
