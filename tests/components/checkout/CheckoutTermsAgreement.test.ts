import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import CheckoutTermsAgreement from '../../../app/components/checkout/CheckoutTermsAgreement.vue';

// shadcn Checkbox stub matching the pattern used elsewhere in the checkout suite.
const stubs = {
  Label: {
    template: '<label><slot /></label>',
    props: ['for'],
  },
  Checkbox: {
    template:
      '<button role="checkbox" :id="id" :aria-checked="modelValue ? \'true\' : \'false\'" :data-state="modelValue ? \'checked\' : \'unchecked\'" :data-disabled="disabled ? \'\' : undefined" :disabled="disabled" v-bind="$attrs" @click="$emit(\'update:modelValue\', !modelValue)"></button>',
    props: ['modelValue', 'disabled', 'id'],
    emits: ['update:modelValue'],
  },
};

describe('CheckoutTermsAgreement', () => {
  it('renders unchecked by default when modelValue=false', () => {
    const wrapper = mountComponent(CheckoutTermsAgreement, {
      props: { modelValue: false },
      global: { stubs },
    });

    const checkbox = wrapper.find(
      '[data-testid="checkout-terms"] [role="checkbox"]',
    );
    expect(checkbox.exists()).toBe(true);
    expect(checkbox.attributes('aria-checked')).toBe('false');
  });

  it('emits update:modelValue with true when clicked', async () => {
    const wrapper = mountComponent(CheckoutTermsAgreement, {
      props: { modelValue: false },
      global: { stubs },
    });

    await wrapper
      .find('[data-testid="checkout-terms"] [role="checkbox"]')
      .trigger('click');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]![0]).toBe(true);
  });

  it('renders a terms link pointing at localePath("/terms") with safe new-tab attrs', () => {
    const wrapper = mountComponent(CheckoutTermsAgreement, {
      props: { modelValue: false },
      global: { stubs },
    });

    const link = wrapper.find('[data-testid="checkout-terms-link"]');
    expect(link.exists()).toBe(true);
    // setup-components mocks localePath to prefix /se/en
    expect(link.attributes('href')).toBe('/se/en/terms');
    expect(link.attributes('target')).toBe('_blank');
    const rel = link.attributes('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('disables the checkbox when disabled=true', () => {
    const wrapper = mountComponent(CheckoutTermsAgreement, {
      props: { modelValue: false, disabled: true },
      global: { stubs },
    });

    const checkbox = wrapper.find(
      '[data-testid="checkout-terms"] [role="checkbox"]',
    );
    expect(checkbox.attributes('data-disabled')).toBeDefined();
  });
});
