// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { FileText } from 'lucide-vue-next';

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

const { mockShowIncVatLocal } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');
  return { mockShowIncVatLocal: ref(true) };
});
vi.mock('~/composables/useVatDisplay', () => ({
  useVatDisplay: () => ({ showIncVat: mockShowIncVatLocal }),
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
  beforeEach(() => {
    mockShowIncVatLocal.value = true;
  });

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

  it('shows the terms and the default labels by default', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps(),
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="checkout-terms"]').exists()).toBe(true);
    expect(wrapper.find('h2').text()).toBe('checkout.order_summary');
    expect(wrapper.find('[data-testid="place-order-button"]').text()).toContain(
      'checkout.place_order',
    );
  });

  it('leaves the terms out with requireTerms false', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ requireTerms: false }),
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="checkout-terms"]').exists()).toBe(false);
  });

  it('enables the button without accepted terms when requireTerms is false', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ requireTerms: false, termsAccepted: false }),
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="place-order-button"]').attributes('disabled'),
    ).toBeUndefined();
  });

  it('still disables the button without terms when it cannot place', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ requireTerms: false, canPlaceOrder: false }),
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="place-order-button"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('uses the given title and action labels', async () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({
        title: 'Summary',
        actionLabel: 'Send request',
        actionPendingLabel: 'Sending',
      }),
      global: { stubs },
    });
    expect(wrapper.find('h2').text()).toBe('Summary');
    const button = wrapper.find('[data-testid="place-order-button"]');
    expect(button.text()).toBe('Send request');
    await wrapper.setProps({ isPlacingOrder: true });
    expect(button.text()).toBe('Sending');
  });

  it('shows the default pending label while placing', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ isPlacingOrder: true }),
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="place-order-button"]').text()).toContain(
      'checkout.placing_order',
    );
  });

  it('says shipping may apply when there is no fee, by default', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ shippingFee: null }),
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="checkout-summary-shipping"]').text(),
    ).toBe('common.shipping_may_apply');
  });

  it('shows the given shipping note when there is no fee', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ shippingFee: null, shippingNote: 'Set in the quote' }),
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="checkout-summary-shipping"]').text(),
    ).toBe('Set in the quote');
  });

  it('shows the fee over the shipping note', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ shippingNote: 'Set in the quote' }),
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="checkout-summary-shipping"]').text(),
    ).toBe('20.00 SEK');
  });
  it("counts with the checkout's items key by default", () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps(),
      global: { stubs },
    });
    expect(wrapper.text()).toContain('(checkout.items_count)');
  });

  it('counts with the given key', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ itemCountKey: 'portal.lines_count' }),
      global: { stubs },
    });
    expect(wrapper.text()).toContain('(portal.lines_count)');
    expect(wrapper.text()).not.toContain('checkout.items_count');
  });

  it('shows no icon on the button by default', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps(),
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="place-order-icon"]').exists()).toBe(
      false,
    );
  });

  it('shows the given icon on the button, and the spinner in its place while placing', async () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ actionIcon: FileText }),
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="place-order-button"]');
    expect(button.find('[data-testid="place-order-icon"]').exists()).toBe(true);
    await wrapper.setProps({ isPlacingOrder: true });
    expect(button.find('[data-testid="place-order-icon"]').exists()).toBe(
      false,
    );
    expect(button.findAll('svg')).toHaveLength(1);
  });
  it('renders the title-aside slot in the heading row', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps(),
      slots: { 'title-aside': '<span data-testid="aside">≈</span>' },
      global: { stubs },
    });
    const row = wrapper.find('[data-testid="checkout-summary-heading"]');
    expect(row.find('h2').exists()).toBe(true);
    expect(row.find('[data-testid="aside"]').exists()).toBe(true);
  });
  it('labels the inc-VAT line "to pay" by default', () => {
    mockShowIncVatLocal.value = false;
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({ toPayIncVat: '150.00 SEK' }),
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="checkout-summary-to-pay"]').text(),
    ).toContain('common.to_pay_inc_vat');
  });

  it('labels the inc-VAT line with the given text', () => {
    mockShowIncVatLocal.value = false;
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps({
        toPayIncVat: '150.00 SEK',
        toPayLabel: 'Total incl. VAT',
      }),
      global: { stubs },
    });
    const line = wrapper.find('[data-testid="checkout-summary-to-pay"]');
    expect(line.text()).toContain('Total incl. VAT');
    expect(line.text()).not.toContain('common.to_pay_inc_vat');
  });
});

describe('CheckoutOrderSummary footer', () => {
  it('renders the footer slot after the place-order button', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps(),
      slots: { footer: '<p data-testid="summary-footer">note</p>' },
      global: { stubs },
    });
    const html = wrapper.html();
    expect(wrapper.find('[data-testid="summary-footer"]').exists()).toBe(true);
    expect(html.indexOf('summary-footer')).toBeGreaterThan(
      html.indexOf('place-order-button'),
    );
    expect(
      wrapper
        .find(
          '[data-testid="checkout-order-summary"] [data-testid="summary-footer"]',
        )
        .exists(),
    ).toBe(true);
  });

  it('renders nothing after the button without a footer', () => {
    const wrapper = mount(CheckoutOrderSummary.default, {
      props: makeProps(),
      global: { stubs },
    });
    const summary = wrapper.find('[data-testid="checkout-order-summary"]');
    expect(summary.element.lastElementChild?.getAttribute('data-testid')).toBe(
      'place-order-button',
    );
  });
});
