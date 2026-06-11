// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('en'),
  }),
}));

vi.stubGlobal('useI18n', () => ({
  t: (key: string) => key,
  locale: ref('en'),
}));

vi.mock('~/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: ref(true) }),
}));

const stubs = {
  Separator: {
    template: '<hr />',
  },
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'size'],
    emits: ['click'],
  },
  CheckoutTermsAgreement: {
    template:
      '<button data-testid="checkout-terms" :data-state="modelValue ? \'checked\' : \'unchecked\'" @click="$emit(\'update:modelValue\', !modelValue)"></button>',
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
  },
};

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    itemCount: 2,
    subtotal: '100.00 SEK',
    shippingFee: '20.00 SEK',
    tax: '25.00 SEK',
    total: '120.00 SEK',
    canPlaceOrder: true,
    isPlacingOrder: false,
    termsAccepted: true,
    ...overrides,
  };
}

const CheckoutOrderSummary =
  await import('../../../../app/components/checkout/CheckoutOrderSummary.vue');

describe('CheckoutOrderSummary', () => {
  it('renders the order summary container', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps(),
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="checkout-order-summary"]').exists(),
    ).toBe(true);
  });

  it('emits placeOrder when place-order button is clicked', async () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ canPlaceOrder: true, isPlacingOrder: false }),
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="place-order-button"]');
    expect(button.exists()).toBe(true);
    await button.trigger('click');
    expect(wrapper.emitted('placeOrder')).toBeTruthy();
    expect(wrapper.emitted('placeOrder')).toHaveLength(1);
  });

  it('button is disabled when canPlaceOrder is false', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ canPlaceOrder: false, isPlacingOrder: false }),
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="place-order-button"]');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('button is disabled when isPlacingOrder is true', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ canPlaceOrder: true, isPlacingOrder: true }),
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="place-order-button"]');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('button is disabled when termsAccepted is false', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ canPlaceOrder: true, termsAccepted: false }),
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="place-order-button"]');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('emits update:termsAccepted when the terms checkbox toggles', async () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ termsAccepted: false }),
      global: { stubs },
    });
    await wrapper.find('[data-testid="checkout-terms"]').trigger('click');
    const emitted = wrapper.emitted('update:termsAccepted');
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]).toEqual([true]);
  });

  it('shows spinner when isPlacingOrder is true', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ canPlaceOrder: true, isPlacingOrder: true }),
      global: { stubs },
    });
    // Loader2 is rendered as an svg when not stubbed; check for the lucide svg class
    const button = wrapper.find('[data-testid="place-order-button"]');
    expect(button.find('svg').exists()).toBe(true);
  });

  it('does not show spinner when isPlacingOrder is false', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ canPlaceOrder: true, isPlacingOrder: false }),
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="place-order-button"]');
    expect(button.find('svg').exists()).toBe(false);
  });
});
