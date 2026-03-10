import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountComponent } from '../../utils/component';
import ContactForm from '../../../app/components/contact/ContactForm.vue';

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
    props: ['type', 'disabled'],
  },
};

// Mock $fetch globally for form submission
vi.stubGlobal('$fetch', vi.fn());

describe('ContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    const wrapper = mountComponent(ContactForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="contact-name"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="contact-email"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="contact-phone"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="contact-subject"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="contact-message"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="contact-submit"]').exists()).toBe(true);
  });

  it('shows validation error on empty required field after blur', async () => {
    const wrapper = mountComponent(ContactForm, { global: { stubs } });
    const nameInput = wrapper.find('[data-testid="contact-name"]');
    await nameInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="contact-name-error"]').exists()).toBe(
      true,
    );
  });

  it('shows validation error for invalid email after blur', async () => {
    const wrapper = mountComponent(ContactForm, { global: { stubs } });
    const emailInput = wrapper.find('[data-testid="contact-email"]');
    // Set value then blur
    await emailInput.setValue('not-an-email');
    await emailInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="contact-email-error"]').exists()).toBe(
      true,
    );
  });

  it('does not show success state initially', () => {
    const wrapper = mountComponent(ContactForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="contact-success"]').exists()).toBe(
      false,
    );
  });

  it('renders the form element with submit handler', () => {
    const wrapper = mountComponent(ContactForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="contact-form"]').exists()).toBe(true);
  });

  it('does not show error message initially', () => {
    const wrapper = mountComponent(ContactForm, { global: { stubs } });
    expect(wrapper.find('[data-testid="contact-error"]').exists()).toBe(false);
  });
});
