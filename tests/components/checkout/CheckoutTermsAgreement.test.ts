import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import CheckoutTermsAgreement from '../../../app/components/checkout/CheckoutTermsAgreement.vue';

// useCmsPageLink mock: the terms link resolves by CMS tag to the merchant's
// localized slug. Controllable per test via these refs.
const mockTermsTo = ref<string | undefined>('/se/sv/villkor');
const mockTermsResolved = ref(true);
vi.mock('../../../app/composables/useCmsPageLink', () => ({
  useCmsPageLink: () => ({ to: mockTermsTo, isResolved: mockTermsResolved }),
}));

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
  beforeEach(() => {
    mockTermsTo.value = '/se/sv/villkor';
    mockTermsResolved.value = true;
  });

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

  it('points the terms link at the CMS-resolved localized slug with safe new-tab attrs', () => {
    mockTermsTo.value = '/se/sv/villkor';
    mockTermsResolved.value = true;

    const wrapper = mountComponent(CheckoutTermsAgreement, {
      props: { modelValue: false },
      global: { stubs },
    });

    const link = wrapper.find('[data-testid="checkout-terms-link"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/se/sv/villkor');
    expect(link.attributes('target')).toBe('_blank');
    const rel = link.attributes('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('renders the terms text as plain text (no link) when no terms page resolves, keeping the checkbox usable', () => {
    mockTermsResolved.value = false;
    mockTermsTo.value = undefined;

    const wrapper = mountComponent(CheckoutTermsAgreement, {
      props: { modelValue: false },
      global: { stubs },
    });

    // The clickable terms link is gone, but the agreement text and the
    // accept-checkbox both still render so the place-order gate stays usable.
    expect(wrapper.find('[data-testid="checkout-terms-link"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="checkout-terms"] [role="checkbox"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="checkout-terms"]').text().length,
    ).toBeGreaterThan(0);
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
