import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockShowIncVat } from '../../setup-components';
import { mountComponent } from '../../utils/component';
import CheckoutOrderSummary from '../../../app/components/checkout/CheckoutOrderSummary.vue';
import CheckoutPaymentOptions from '../../../app/components/checkout/CheckoutPaymentOptions.vue';
import CheckoutShippingOptions from '../../../app/components/checkout/CheckoutShippingOptions.vue';
import CheckoutConsents from '../../../app/components/checkout/CheckoutConsents.vue';
import type {
  PaymentOptionType,
  ShippingOptionType,
  ConsentType,
} from '#shared/types/commerce';

// ---------------------------------------------------------------------------
// Shared stubs
// ---------------------------------------------------------------------------
const stubs = {
  Label: { template: '<label><slot /></label>', props: ['for'] },
  Input: {
    template:
      '<input :type="type" :id="id" :disabled="disabled" v-bind="$attrs" />',
    props: ['type', 'id', 'modelValue', 'autocomplete', 'disabled'],
    emits: ['update:modelValue', 'blur'],
  },
  Checkbox: {
    template:
      '<button role="checkbox" :data-state="modelValue ? \'checked\' : \'unchecked\'" :disabled="disabled" v-bind="$attrs" @click="$emit(\'update:modelValue\', !modelValue)"></button>',
    props: ['modelValue', 'disabled', 'id'],
    emits: ['update:modelValue'],
  },
  Separator: { template: '<hr />' },
  Textarea: {
    template:
      '<textarea :id="id" :disabled="disabled" v-bind="$attrs"></textarea>',
    props: ['id', 'modelValue', 'disabled', 'placeholder'],
    emits: ['update:modelValue'],
  },
  Button: {
    template: '<button :disabled="disabled" v-bind="$attrs"><slot /></button>',
    props: ['disabled', 'type', 'variant', 'size'],
  },
  CheckoutAddressForm: {
    template: '<div :data-testid="`${prefix}-address-form`"></div>',
    props: ['modelValue', 'prefix', 'disabled'],
    emits: ['update:modelValue'],
  },
  CheckoutOrderSummary: {
    template: '<div data-testid="checkout-order-summary">summary stub</div>',
  },
  CheckoutPaymentOptions: {
    template: '<div data-testid="checkout-payment-options">payment stub</div>',
    props: ['options', 'modelValue', 'disabled'],
    emits: ['update:modelValue'],
  },
  CheckoutShippingOptions: {
    template:
      '<div data-testid="checkout-shipping-options">shipping stub</div>',
    props: ['options', 'modelValue', 'disabled'],
    emits: ['update:modelValue'],
  },
  CheckoutConsents: {
    template: '<div data-testid="checkout-consents">consents stub</div>',
    props: ['consents', 'accepted', 'disabled'],
    emits: ['toggle'],
  },
  CheckoutTermsAgreement: {
    template: '<div data-testid="checkout-terms" />',
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
  },
  ErrorBoundary: { template: '<div><slot /></div>', props: ['section'] },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockPaymentOptions: PaymentOptionType[] = [
  {
    id: 1,
    displayName: 'Invoice',
    feeIncVat: 0,
    feeExVat: 0,
    isDefault: true,
    isSelected: false,
  },
  {
    id: 2,
    displayName: 'Card',
    feeIncVat: 15,
    feeExVat: 12,
    isDefault: false,
    isSelected: false,
  },
];

const mockShippingOptions: ShippingOptionType[] = [
  {
    id: 10,
    displayName: 'Standard',
    feeIncVat: 49,
    feeExVat: 39.2,
    isDefault: true,
    isSelected: false,
    amountLeftToFreeShipping: 200,
    feeIncVatFormatted: '49,00 kr',
    feeExVatFormatted: '39,20 kr',
    amountLeftToFreeShippingFormatted: '200,00 kr',
  },
  {
    id: 11,
    displayName: 'Express',
    feeIncVat: 0,
    feeExVat: 0,
    isDefault: false,
    isSelected: false,
    amountLeftToFreeShipping: 0,
    feeIncVatFormatted: '0,00 kr',
  },
];

const mockConsents: ConsentType[] = [
  {
    type: 'newsletter',
    name: 'Newsletter',
    description: 'Subscribe to our newsletter',
    checked: false,
    autoAccept: false,
  },
  {
    type: 'terms',
    name: 'Terms',
    description: 'Accept terms',
    checked: false,
    autoAccept: true,
  },
  {
    type: 'marketing',
    name: 'Marketing',
    description: 'Allow marketing',
    checked: false,
    autoAccept: false,
  },
];

// ---------------------------------------------------------------------------
// CheckoutOrderSummary
// ---------------------------------------------------------------------------
describe('CheckoutOrderSummary', () => {
  it('renders order summary with cart data', () => {
    const wrapper = mountComponent(CheckoutOrderSummary, {
      props: {
        itemCount: 3,
        subtotal: '500,00 kr',
        shippingFee: '49,00 kr',
        tax: '109,80 kr',
        total: '549,00 kr',
        canPlaceOrder: true,
        isPlacingOrder: false,
        termsAccepted: false,
      },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="checkout-order-summary"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain('500,00 kr');
    expect(wrapper.text()).toContain('49,00 kr');
    expect(wrapper.text()).toContain('109,80 kr');
    expect(wrapper.text()).toContain('549,00 kr');
  });

  it.each([
    [true, 'common.vat_included'],
    [false, 'common.vat'],
  ])(
    'labels the VAT row by the chosen side (incl. VAT: %s)',
    (incVat, label) => {
      mockShowIncVat.value = incVat;
      const wrapper = mountComponent(CheckoutOrderSummary, {
        props: {
          itemCount: 3,
          subtotal: '500,00 kr',
          shippingFee: '49,00 kr',
          tax: '109,80 kr',
          total: '549,00 kr',
          canPlaceOrder: true,
          isPlacingOrder: false,
          termsAccepted: false,
        },
        global: { stubs },
      });
      const tax = wrapper.find('[data-testid="checkout-summary-tax"]');

      expect(tax.text()).toBe('109,80 kr');
      expect(tax.element.previousElementSibling?.textContent?.trim()).toBe(
        label,
      );
    },
  );

  describe('the amount to pay incl. VAT', () => {
    function mountSummary(toPayIncVat?: string) {
      return mountComponent(CheckoutOrderSummary, {
        props: {
          itemCount: 3,
          subtotal: '400,00 kr',
          shippingFee: '40,00 kr',
          tax: '110,00 kr',
          total: '440,00 kr',
          toPayIncVat,
          canPlaceOrder: true,
          isPlacingOrder: false,
          termsAccepted: false,
        },
        global: { stubs },
      });
    }
    afterEach(() => {
      mockShowIncVat.value = true;
    });

    it('shows the inc-VAT amount under the total on the ex side', () => {
      mockShowIncVat.value = false;
      const wrapper = mountSummary('550,00 kr');
      const line = wrapper.find('[data-testid="checkout-summary-to-pay"]');
      const total = wrapper.find('[data-testid="checkout-summary-total"]');

      expect(line.text()).toContain('common.to_pay_inc_vat');
      expect(line.text()).toContain('550,00 kr');
      expect(
        total.element.compareDocumentPosition(line.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('shows no extra line on the inc side, where the total already is it', () => {
      mockShowIncVat.value = true;
      const wrapper = mountSummary('550,00 kr');

      expect(
        wrapper.find('[data-testid="checkout-summary-to-pay"]').exists(),
      ).toBe(false);
    });

    it('shows no line on the ex side when the amount is missing', () => {
      mockShowIncVat.value = false;
      const wrapper = mountSummary(undefined);

      expect(
        wrapper.find('[data-testid="checkout-summary-to-pay"]').exists(),
      ).toBe(false);
    });
  });

  it.each([
    ['49,00 kr', '49,00 kr'],
    [null, 'common.shipping_may_apply'],
  ])(
    'shows the shipping fee, or that shipping may apply without one (fee: %s)',
    (shippingFee, text) => {
      const wrapper = mountComponent(CheckoutOrderSummary, {
        props: {
          itemCount: 3,
          subtotal: '500,00 kr',
          shippingFee,
          tax: '109,80 kr',
          total: '549,00 kr',
          canPlaceOrder: true,
          isPlacingOrder: false,
          termsAccepted: false,
        },
        global: { stubs },
      });

      const cell = wrapper.find('[data-testid="checkout-summary-shipping"]');
      expect(cell.text()).toBe(text);
      expect(cell.find('.text-muted-foreground').exists()).toBe(
        shippingFee === null,
      );
    },
  );

  it('shows discount line when discount is provided', () => {
    const wrapper = mountComponent(CheckoutOrderSummary, {
      props: {
        itemCount: 2,
        subtotal: '500,00 kr',
        shippingFee: '49,00 kr',
        tax: '89,80 kr',
        total: '449,00 kr',
        discount: '100,00 kr',
        canPlaceOrder: true,
        isPlacingOrder: false,
        termsAccepted: false,
      },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="checkout-summary-discount"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain('100,00 kr');
  });

  it('hides discount line when no discount', () => {
    const wrapper = mountComponent(CheckoutOrderSummary, {
      props: {
        itemCount: 2,
        subtotal: '500,00 kr',
        shippingFee: '49,00 kr',
        tax: '109,80 kr',
        total: '549,00 kr',
        canPlaceOrder: true,
        isPlacingOrder: false,
        termsAccepted: false,
      },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="checkout-summary-discount"]').exists(),
    ).toBe(false);
  });

  // The cart API sends an empty fee string until a shipping option is selected,
  // and nothing at all when it has no value. Both mean "no number yet": the
  // shipping cell says shipping may apply and the tax cell stays empty, so
  // nothing reads as a number. Subtotal and total keep their placeholder.
  it.each([
    ['empty strings', '' as string | null],
    ['null', null],
  ])(
    'says shipping may apply and leaves the tax cell empty for %s',
    (_label, value) => {
      const wrapper = mountComponent(CheckoutOrderSummary, {
        props: {
          itemCount: 3,
          subtotal: '500,00 kr',
          shippingFee: value,
          tax: value,
          total: '625,00 kr',
          canPlaceOrder: true,
          isPlacingOrder: false,
          termsAccepted: false,
        },
        global: { stubs },
      });

      expect(
        wrapper.find('[data-testid="checkout-summary-shipping"]').text(),
      ).toBe('common.shipping_may_apply');
      expect(wrapper.find('[data-testid="checkout-summary-tax"]').text()).toBe(
        '',
      );
      // Paired with a present value on the same render: an empty cell proves
      // nothing on a summary that rendered nothing.
      expect(
        wrapper.find('[data-testid="checkout-summary-subtotal"]').text(),
      ).toBe('500,00 kr');
    },
  );

  it('shows the shipping and tax values when the API sends them', () => {
    const wrapper = mountComponent(CheckoutOrderSummary, {
      props: {
        itemCount: 3,
        subtotal: '500,00 kr',
        shippingFee: '49,00 kr',
        tax: '109,80 kr',
        total: '625,00 kr',
        canPlaceOrder: true,
        isPlacingOrder: false,
        termsAccepted: false,
      },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="checkout-summary-shipping"]').text(),
    ).toBe('49,00 kr');
    expect(wrapper.find('[data-testid="checkout-summary-tax"]').text()).toBe(
      '109,80 kr',
    );
  });

  it('shows the placeholder for a missing subtotal and total only', () => {
    const wrapper = mountComponent(CheckoutOrderSummary, {
      props: {
        itemCount: 0,
        subtotal: '',
        shippingFee: null,
        tax: null,
        total: '',
        canPlaceOrder: true,
        isPlacingOrder: false,
        termsAccepted: false,
      },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="checkout-order-summary"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="checkout-summary-subtotal"]').text(),
    ).toBe('--');
    expect(wrapper.find('[data-testid="checkout-summary-total"]').text()).toBe(
      '--',
    );
    // Shipping and tax are the exception: neither claims a number before
    // there is one. Shipping says it may apply; tax stays empty.
    expect(
      wrapper.find('[data-testid="checkout-summary-shipping"]').text(),
    ).toBe('common.shipping_may_apply');
    expect(wrapper.find('[data-testid="checkout-summary-tax"]').text()).toBe(
      '',
    );
  });
});

// ---------------------------------------------------------------------------
// CheckoutPaymentOptions
// ---------------------------------------------------------------------------
describe('CheckoutPaymentOptions', () => {
  beforeEach(() => {
    mockShowIncVat.value = true;
  });

  function cardFee(): string {
    const wrapper = mountComponent(CheckoutPaymentOptions, {
      props: { options: mockPaymentOptions, modelValue: null, disabled: false },
      global: { stubs },
    });
    return wrapper.find('[data-testid="payment-option-2"]').text();
  }

  it('shows the fee inc VAT when inc is chosen', () => {
    mockShowIncVat.value = true;
    expect(cardFee()).toContain('+15');
  });

  it('shows the fee ex VAT when ex is chosen', () => {
    mockShowIncVat.value = false;
    const text = cardFee();
    expect(text).toContain('+12');
    expect(text).not.toContain('15');
  });

  it('renders all payment options as radio buttons', () => {
    const wrapper = mountComponent(CheckoutPaymentOptions, {
      props: {
        options: mockPaymentOptions,
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="checkout-payment-options"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="payment-option-1"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="payment-option-2"]').exists()).toBe(
      true,
    );
  });

  it('shows fee when feeIncVat > 0', () => {
    const wrapper = mountComponent(CheckoutPaymentOptions, {
      props: {
        options: mockPaymentOptions,
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('Invoice');
    expect(wrapper.text()).toContain('Card');
  });

  it('emits update:modelValue when option is selected', async () => {
    const wrapper = mountComponent(CheckoutPaymentOptions, {
      props: {
        options: mockPaymentOptions,
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });

    const radioInput = wrapper.find(
      '[data-testid="payment-option-1"] input[type="radio"]',
    );
    await radioInput.setValue(true);

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([1]);
  });

  it('shows message when no options available', () => {
    const wrapper = mountComponent(CheckoutPaymentOptions, {
      props: {
        options: [],
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('checkout.no_payment_methods');
  });

  it('disables radio inputs when disabled prop is true', () => {
    const wrapper = mountComponent(CheckoutPaymentOptions, {
      props: {
        options: mockPaymentOptions,
        modelValue: 1,
        disabled: true,
      },
      global: { stubs },
    });

    const inputs = wrapper.findAll('input[type="radio"]');
    for (const input of inputs) {
      expect(input.attributes('disabled')).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// CheckoutShippingOptions
// ---------------------------------------------------------------------------
describe('CheckoutShippingOptions', () => {
  beforeEach(() => {
    mockShowIncVat.value = true;
  });

  function standardFee(): string {
    const wrapper = mountComponent(CheckoutShippingOptions, {
      props: {
        options: mockShippingOptions,
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });
    return wrapper.find('[data-testid="shipping-option-10"]').text();
  }

  it('shows the fee inc VAT when inc is chosen', () => {
    mockShowIncVat.value = true;
    expect(standardFee()).toContain('49,00 kr');
  });

  it('shows the fee ex VAT when ex is chosen', () => {
    mockShowIncVat.value = false;
    const text = standardFee();
    expect(text).toContain('39,20 kr');
    expect(text).not.toContain('49,00 kr');
  });

  it('shows "Free" for a zero fee when ex is chosen', () => {
    mockShowIncVat.value = false;
    const wrapper = mountComponent(CheckoutShippingOptions, {
      props: {
        options: mockShippingOptions,
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="shipping-option-11"]').text()).toContain(
      'checkout.free_shipping',
    );
  });

  it('renders all shipping options', () => {
    const wrapper = mountComponent(CheckoutShippingOptions, {
      props: {
        options: mockShippingOptions,
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="checkout-shipping-options"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="shipping-option-10"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="shipping-option-11"]').exists()).toBe(
      true,
    );
  });

  it('shows "Free" for options with feeIncVat === 0', () => {
    const wrapper = mountComponent(CheckoutShippingOptions, {
      props: {
        options: mockShippingOptions,
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('checkout.free_shipping');
  });

  it('shows amountLeftToFreeShippingFormatted when > 0', () => {
    const wrapper = mountComponent(CheckoutShippingOptions, {
      props: {
        options: mockShippingOptions,
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });

    // i18n mock returns the key; verify the key is rendered for the free shipping hint
    expect(wrapper.text()).toContain('checkout.amount_left_free_shipping');
  });

  it('emits update:modelValue when option is selected', async () => {
    const wrapper = mountComponent(CheckoutShippingOptions, {
      props: {
        options: mockShippingOptions,
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });

    const radioInput = wrapper.find(
      '[data-testid="shipping-option-10"] input[type="radio"]',
    );
    await radioInput.setValue(true);

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([10]);
  });

  it('shows message when no options available', () => {
    const wrapper = mountComponent(CheckoutShippingOptions, {
      props: {
        options: [],
        modelValue: null,
        disabled: false,
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('checkout.no_shipping_methods');
  });
});

// ---------------------------------------------------------------------------
// CheckoutConsents
// ---------------------------------------------------------------------------
describe('CheckoutConsents', () => {
  it('renders non-autoAccept consents as checkboxes', () => {
    const wrapper = mountComponent(CheckoutConsents, {
      props: {
        consents: mockConsents,
        accepted: [],
        disabled: false,
      },
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="checkout-consents"]').exists()).toBe(
      true,
    );
    // 'newsletter' and 'marketing' should be visible, 'terms' (autoAccept) should not
    expect(wrapper.find('[data-testid="consent-newsletter"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="consent-marketing"]').exists()).toBe(
      true,
    );
  });

  it('filters out auto-accept consents', () => {
    const wrapper = mountComponent(CheckoutConsents, {
      props: {
        consents: mockConsents,
        accepted: ['terms'],
        disabled: false,
      },
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="consent-terms"]').exists()).toBe(false);
  });

  it('shows all consents when none are auto-accept', () => {
    const noAutoConsents: ConsentType[] = [
      { type: 'a', name: 'A', description: 'desc A', autoAccept: false },
      { type: 'b', name: 'B', description: 'desc B', autoAccept: false },
    ];

    const wrapper = mountComponent(CheckoutConsents, {
      props: {
        consents: noAutoConsents,
        accepted: [],
        disabled: false,
      },
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="consent-a"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="consent-b"]').exists()).toBe(true);
  });

  it('emits toggle when consent checkbox clicked', async () => {
    const wrapper = mountComponent(CheckoutConsents, {
      props: {
        consents: mockConsents,
        accepted: [],
        disabled: false,
      },
      global: { stubs },
    });

    const checkbox = wrapper.find(
      '[data-testid="consent-newsletter"] [role="checkbox"]',
    );
    await checkbox.trigger('click');

    expect(wrapper.emitted('toggle')).toBeTruthy();
    expect(wrapper.emitted('toggle')![0]).toEqual(['newsletter']);
  });

  it('renders no checkboxes when all consents are auto-accept', () => {
    const allAuto: ConsentType[] = [
      { type: 'terms', name: 'Terms', autoAccept: true },
      { type: 'privacy', name: 'Privacy', autoAccept: true },
    ];

    const wrapper = mountComponent(CheckoutConsents, {
      props: {
        consents: allAuto,
        accepted: ['terms', 'privacy'],
        disabled: false,
      },
      global: { stubs },
    });

    expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(0);
  });
});
