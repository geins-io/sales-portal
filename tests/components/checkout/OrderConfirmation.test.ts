import { describe, it, expect, beforeEach } from 'vitest';
import { mockShowIncVat } from '../../setup-components';
import { mountComponent } from '../../utils/component';
import OrderConfirmation from '../../../app/components/checkout/OrderConfirmation.vue';

const mockSummary = {
  orderId: 'ORD-215',
  rows: [
    {
      quantity: 2,
      articleNumber: 'ART-001',
      name: 'Widget A',
      product: { name: 'Widget A' },
      price: {
        priceIncVat: 89.99,
        priceIncVatFormatted: '$89.99',
        priceExVat: 72,
        priceExVatFormatted: '$72.00',
      },
    },
    {
      quantity: 1,
      articleNumber: 'ART-002',
      name: 'Gadget B',
      product: { name: 'Gadget B' },
      price: {
        priceIncVat: 49.5,
        priceIncVatFormatted: '$49.50',
        priceExVat: 39.6,
        priceExVatFormatted: '$39.60',
      },
    },
    {
      quantity: 3,
      articleNumber: 'ART-003',
      name: 'Doohickey C',
      product: { name: 'Doohickey C' },
      price: {
        priceIncVat: 19.99,
        priceIncVatFormatted: '$19.99',
        priceExVat: 16,
        priceExVatFormatted: '$16.00',
      },
    },
  ],
  total: {
    itemValueExVat: 232,
    itemValueIncVat: 290,
    itemValueIncVatFormatted: '$290.00',
    itemValueExVatFormatted: '$232.00',
    orderValueExVat: 240,
    orderValueExVatFormatted: '$240.00',
    shippingFeeIncVat: 10,
    shippingFeeIncVatFormatted: '$10.00',
    discountIncVat: 0,
    discountIncVatFormatted: '$0.00',
    sum: 300,
    sumFormatted: '$300.00',
    currency: 'SEK',
  },
  billingAddress: {
    firstName: 'John',
    lastName: 'Doe',
    company: 'Acme Inc',
    addressLine1: '123 Main St',
    addressLine2: 'Suite 4',
    city: 'Stockholm',
    zip: '11122',
    country: 'Sweden',
  },
  shippingAddress: {
    firstName: 'Jane',
    lastName: 'Smith',
    company: 'Warehouse 4',
    addressLine1: '456 Oak Ave',
    city: 'Gothenburg',
    zip: '41101',
    country: 'Sweden',
  },
};

function mountConfirmation(props: Record<string, unknown> = {}) {
  return mountComponent(OrderConfirmation, {
    props: {
      summary: mockSummary,
      isLoading: false,
      ...props,
    },
  });
}

describe('OrderConfirmation', () => {
  beforeEach(() => {
    mockShowIncVat.value = true;
  });

  it('renders the order-confirmed heading', () => {
    const wrapper = mountConfirmation();
    expect(wrapper.text()).toContain('order_confirmation.thank_you');
    expect(wrapper.text()).toContain(
      'order_confirmation.confirmation_subtitle',
    );
  });

  it('renders the check icon using the theme primary token', () => {
    const wrapper = mountConfirmation();
    const icon = wrapper.find('[data-testid="confirm-icon"]');
    expect(icon.exists()).toBe(true);
    expect(icon.classes().join(' ')).toContain('text-primary');
  });

  it('displays the order number badge', () => {
    const wrapper = mountConfirmation();
    const badge = wrapper.find('[data-testid="order-number"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toContain('ORD-215');
  });

  it('falls back to the orderNumber prop when the summary has not propagated', () => {
    const wrapper = mountConfirmation({
      summary: null,
      orderNumber: '1433',
    });
    const badge = wrapper.find('[data-testid="order-number"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toContain('1433');
  });

  it('prefers the summary order id over the prop when both are present', () => {
    const wrapper = mountConfirmation({
      orderNumber: '9999',
    });
    const badge = wrapper.find('[data-testid="order-number"]');
    expect(badge.text()).toContain('ORD-215');
    expect(badge.text()).not.toContain('9999');
  });

  it('shows buyer name from billing address', () => {
    const wrapper = mountConfirmation();
    const buyer = wrapper.find('[data-testid="buyer-info"]');
    expect(buyer.exists()).toBe(true);
    expect(buyer.text()).toContain('John Doe');
  });

  it('shows billing address company + lines without the person name', () => {
    const wrapper = mountConfirmation();
    const billing = wrapper.find('[data-testid="billing-address"]');
    expect(billing.exists()).toBe(true);
    expect(billing.text()).toContain('Acme Inc');
    expect(billing.text()).toContain('123 Main St');
    expect(billing.text()).toContain('Stockholm');
    expect(billing.text()).not.toContain('John Doe');
  });

  it('shows shipping address company + lines without the person name', () => {
    const wrapper = mountConfirmation();
    const shipping = wrapper.find('[data-testid="shipping-address"]');
    expect(shipping.exists()).toBe(true);
    expect(shipping.text()).toContain('Warehouse 4');
    expect(shipping.text()).toContain('456 Oak Ave');
    expect(shipping.text()).not.toContain('Jane Smith');
  });

  it('renders item list rows', () => {
    const wrapper = mountConfirmation();
    const list = wrapper.find('[data-testid="items-list"]');
    expect(list.exists()).toBe(true);
    const rows = list.findAll('li');
    expect(rows.length).toBe(3);
    expect(list.text()).toContain('Widget A');
    expect(list.text()).toContain('SKU: ART-001');
  });

  it('shows items total badge', () => {
    const wrapper = mountConfirmation();
    const badge = wrapper.find('[data-testid="items-total-badge"]');
    expect(badge.exists()).toBe(true);
    // i18n stub returns the key; the count is fed via interpolation params,
    // which the stub drops. Assert on the key and check rendered row count.
    expect(badge.text()).toContain('order_confirmation.items_total');
    expect(wrapper.findAll('[data-testid="items-list"] li').length).toBe(3);
  });

  it('collapses item list when rows exceed the limit and toggles open', async () => {
    const longSummary = {
      ...mockSummary,
      rows: [
        ...mockSummary.rows,
        {
          quantity: 1,
          articleNumber: 'ART-004',
          name: 'Widget D',
          product: { name: 'Widget D' },
          price: { priceIncVat: 5, priceIncVatFormatted: '$5.00' },
        },
      ],
    };
    const wrapper = mountConfirmation({ summary: longSummary });
    const list = wrapper.find('[data-testid="items-list"]');
    expect(list.findAll('li').length).toBe(3);
    const toggle = wrapper.find('[data-testid="toggle-items"]');
    expect(toggle.exists()).toBe(true);
    await toggle.trigger('click');
    expect(
      wrapper.find('[data-testid="items-list"]').findAll('li').length,
    ).toBe(4);
  });

  it('does not render toggle when row count is within the limit', () => {
    const wrapper = mountConfirmation();
    expect(wrapper.find('[data-testid="toggle-items"]').exists()).toBe(false);
  });

  it('shows the grey summary box with subtotal, vat and total', () => {
    const wrapper = mountConfirmation();
    const box = wrapper.find('[data-testid="summary-box"]');
    expect(box.exists()).toBe(true);
    expect(box.text()).toContain('$290.00');
    expect(box.find('[data-testid="summary-total"]').text()).toContain(
      '$300.00',
    );
  });

  it('hides discount row when none', () => {
    const wrapper = mountConfirmation();
    expect(wrapper.find('[data-testid="summary-discount"]').exists()).toBe(
      false,
    );
  });

  it('shows discount row when present', () => {
    const summary = {
      ...mockSummary,
      total: {
        ...mockSummary.total,
        discountIncVat: 20,
        discountIncVatFormatted: '$20.00',
      },
    };
    const wrapper = mountConfirmation({ summary });
    const discount = wrapper.find('[data-testid="summary-discount"]');
    expect(discount.exists()).toBe(true);
    expect(discount.text()).toContain('$20.00');
  });

  it('renders the payment label it is given, as it is', () => {
    const wrapper = mountConfirmation({ paymentLabel: 'Faktura 30 dagar' });
    const label = wrapper.find('[data-testid="payment-label"]');
    expect(label.text()).toBe('Faktura 30 dagar');
  });

  it('omits payment method block when prop is missing', () => {
    const wrapper = mountConfirmation();
    expect(wrapper.find('[data-testid="payment-label"]').exists()).toBe(false);
  });

  it('renders reference block when reference prop is set', () => {
    const wrapper = mountConfirmation({ reference: 'REF-8842-X' });
    const label = wrapper.find('[data-testid="reference-label"]');
    expect(label.exists()).toBe(true);
    expect(wrapper.text()).toContain('REF-8842-X');
  });

  describe('view order', () => {
    const PUBLIC_ID = '8dd16643-aaaa-bbbb-cccc-000000000000';
    const ORDER_PAGE = `/se/en/portal/orders/${PUBLIC_ID}?awaiting=${PUBLIC_ID}`;

    it("goes to the order's own page, waiting for it, once the order is shown", () => {
      const cta = mountConfirmation({ publicOrderId: PUBLIC_ID }).find(
        '[data-testid="view-order-cta"]',
      );
      expect(cta.attributes('href')).toBe(ORDER_PAGE);
    });

    it("goes to the order's own page before the order is readable too", () => {
      const cta = mountConfirmation({
        summary: null,
        publicOrderId: PUBLIC_ID,
      }).find('[data-testid="view-order-cta"]');
      expect(cta.attributes('href')).toBe(ORDER_PAGE);
    });

    it('goes to the order list when there is no order id at all', () => {
      const cta = mountConfirmation().find('[data-testid="view-order-cta"]');
      expect(cta.attributes('href')).toBe('/se/en/portal/orders');
    });
  });

  it('renders back-to-store link below the card', () => {
    const wrapper = mountConfirmation();
    const back = wrapper.find('[data-testid="back-to-store"]');
    expect(back.exists()).toBe(true);
    expect(back.attributes('href')).toBe('/se/en/');
  });

  it('shows loading skeleton when isLoading is true', () => {
    const wrapper = mountConfirmation({ isLoading: true, summary: null });
    expect(
      wrapper.find('[data-testid="order-confirmation-loading"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="items-list"]').exists()).toBe(false);
  });

  it('renders the same header card with CTA when summary is unavailable', () => {
    const wrapper = mountConfirmation({ summary: null });
    expect(wrapper.text()).toContain('order_confirmation.thank_you');
    expect(wrapper.text()).toContain(
      'order_confirmation.confirmation_subtitle',
    );
    expect(wrapper.find('[data-testid="items-list"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="order-number"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="view-order-cta"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="back-to-store"]').exists()).toBe(true);
    // Never display the legacy "Order not found" error text.
    expect(wrapper.text()).not.toContain('order_confirmation.order_not_found');
  });

  describe('a row from the order', () => {
    const orderRow = {
      quantity: 2,
      articleNumber: 'ART-010',
      name: 'Cabinet',
      product: { name: 'Cabinet' },
      price: {
        priceIncVat: 125,
        priceIncVatFormatted: '125,00 kr',
        priceExVat: 100,
        priceExVatFormatted: '100,00 kr',
      },
      unitPrice: {
        sellingPriceIncVat: 125,
        sellingPriceIncVatFormatted: '125,00 kr',
        sellingPriceExVat: 100,
        sellingPriceExVatFormatted: '100,00 kr',
      },
      totalPrice: {
        sellingPriceIncVat: 250,
        sellingPriceIncVatFormatted: '250,00 kr',
        sellingPriceExVat: 200,
        sellingPriceExVatFormatted: '200,00 kr',
      },
    };

    function mountWithRow(row: Record<string, unknown>) {
      return mountComponent(OrderConfirmation, {
        props: {
          summary: { ...mockSummary, rows: [row] },
          isLoading: false,
        },
        global: {
          stubs: {
            LineSpecification: {
              props: ['id', 'productName', 'quantity', 'configuration'],
              template:
                '<div data-testid="line-specification" :data-id="id">{{ productName }} x{{ quantity }}</div>',
            },
          },
        },
      });
    }

    it.each([
      [true, '250,00 kr', '2 × 125,00 kr'],
      [false, '200,00 kr', '2 × 100,00 kr'],
    ])(
      'shows its own formatted line total (incl. VAT: %s)',
      (incVat, total, perUnit) => {
        mockShowIncVat.value = incVat;
        const row = mountWithRow(orderRow).find(
          '[data-testid="items-list"] li',
        );

        expect(row.text()).toContain(total);
        expect(row.text()).toContain(perUnit);
        expect(row.text()).not.toContain('SEK');
      },
    );

    it('shows a configured row as configured, with its specification', () => {
      const row = mountWithRow({
        ...orderRow,
        configuration: { summary: [{ label: 'Colour', value: 'Red' }] },
      }).find('[data-testid="items-list"] li');

      expect(row.find('[data-testid="order-item-configured"]').text()).toBe(
        'cart.configured_product',
      );
      expect(row.find('[data-testid="line-specification"]').text()).toBe(
        'Cabinet x2',
      );
    });

    it('shows a plain row without a specification', () => {
      const row = mountWithRow(orderRow).find('[data-testid="items-list"] li');

      expect(row.find('[data-testid="order-item-configured"]').exists()).toBe(
        false,
      );
      expect(row.find('[data-testid="line-specification"]').exists()).toBe(
        false,
      );
    });
  });

  describe('fees', () => {
    const fees = {
      shippingFeeIncVat: 62.5,
      shippingFeeIncVatFormatted: '62,50 kr',
      shippingFeeExVat: 50,
      shippingFeeExVatFormatted: '50,00 kr',
      paymentFeeIncVat: 25,
      paymentFeeIncVatFormatted: '25,00 kr',
      paymentFeeExVat: 20,
      paymentFeeExVatFormatted: '20,00 kr',
    };

    function mountWithTotal(total: Record<string, unknown>) {
      return mountConfirmation({
        summary: { ...mockSummary, total: { ...mockSummary.total, ...total } },
      });
    }

    it.each([
      [true, '62,50 kr', '25,00 kr'],
      [false, '50,00 kr', '20,00 kr'],
    ])(
      'shows shipping and the payment fee on the chosen side (incl. VAT: %s)',
      (incVat, shipping, payment) => {
        mockShowIncVat.value = incVat;
        const wrapper = mountWithTotal(fees);

        expect(
          wrapper.find('[data-testid="summary-shipping"]').text(),
        ).toContain(shipping);
        expect(
          wrapper.find('[data-testid="summary-payment-fee"]').text(),
        ).toContain(payment);
      },
    );

    it.each([
      [
        'zero',
        {
          shippingFeeIncVat: 0,
          shippingFeeExVat: 0,
          paymentFeeIncVat: 0,
          paymentFeeExVat: 0,
        },
      ],
      [
        'absent',
        {
          shippingFeeIncVat: undefined,
          shippingFeeIncVatFormatted: undefined,
          shippingFeeExVat: undefined,
          shippingFeeExVatFormatted: undefined,
        },
      ],
    ])('shows no fee rows when the fees are %s', (_, total) => {
      const wrapper = mountWithTotal(total);

      expect(wrapper.find('[data-testid="summary-shipping"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="summary-payment-fee"]').exists()).toBe(
        false,
      );
      expect(wrapper.text()).not.toContain('common.shipping_may_apply');
    });
  });

  it("shows the order's own VAT when it carries one", () => {
    const wrapper = mountConfirmation({
      summary: {
        ...mockSummary,
        total: { ...mockSummary.total, vatFormatted: '58,00 kr' },
      },
    });

    expect(wrapper.find('[data-testid="summary-vat"]').text()).toBe('58,00 kr');
  });

  describe('follows the VAT choice', () => {
    const discounted = {
      ...mockSummary,
      total: {
        ...mockSummary.total,
        discountIncVat: 25,
        discountIncVatFormatted: '$25.00',
        discountExVat: 20,
        discountExVatFormatted: '$20.00',
      },
    };

    it('shows rows, subtotal, discount and total inc VAT when inc is chosen', () => {
      mockShowIncVat.value = true;
      const wrapper = mountConfirmation({ summary: discounted });
      const firstRow = wrapper.findAll('[data-testid="items-list"] li')[0]!;

      expect(firstRow.text()).toContain('2 × $89.99');
      expect(firstRow.text()).toContain('179.98');
      expect(wrapper.find('[data-testid="summary-subtotal"]').text()).toBe(
        '$290.00',
      );
      expect(wrapper.find('[data-testid="summary-discount"]').text()).toContain(
        '$25.00',
      );
      expect(wrapper.find('[data-testid="summary-total"]').text()).toContain(
        '$300.00',
      );
    });

    it('shows rows, subtotal, discount and total ex VAT when ex is chosen', () => {
      mockShowIncVat.value = false;
      const wrapper = mountConfirmation({ summary: discounted });
      const firstRow = wrapper.findAll('[data-testid="items-list"] li')[0]!;

      expect(firstRow.text()).toContain('2 × $72.00');
      expect(firstRow.text()).toContain('144');
      expect(firstRow.text()).not.toContain('89.99');
      expect(wrapper.find('[data-testid="summary-subtotal"]').text()).toBe(
        '$232.00',
      );
      expect(wrapper.find('[data-testid="summary-discount"]').text()).toContain(
        '$20.00',
      );
      const total = wrapper.find('[data-testid="summary-total"]').text();
      expect(total).toContain('$240.00');
      expect(total).not.toContain('$300.00');
    });

    it.each([
      [true, 'common.vat_included'],
      [false, 'common.vat'],
    ])(
      'labels the VAT row by the chosen side (incl. VAT: %s)',
      (incVat, label) => {
        mockShowIncVat.value = incVat;
        const vat = mountConfirmation().find('[data-testid="summary-vat"]');

        expect(vat.element.previousElementSibling?.textContent?.trim()).toBe(
          label,
        );
      },
    );

    it('shows the amount charged incl. VAT under the total on the ex side', () => {
      mockShowIncVat.value = false;
      const wrapper = mountConfirmation();
      const line = wrapper.find('[data-testid="summary-to-pay"]');

      expect(line.text()).toContain('common.to_pay_inc_vat');
      expect(line.text()).toContain('$300.00');
      expect(
        wrapper
          .find('[data-testid="summary-total"]')
          .element.compareDocumentPosition(line.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('shows no extra line on the inc side', () => {
      mockShowIncVat.value = true;

      expect(
        mountConfirmation().find('[data-testid="summary-to-pay"]').exists(),
      ).toBe(false);
    });

    it.each([
      [0, '$0.00'],
      [undefined, undefined],
    ])(
      'shows no line on the ex side when the amount charged is %s',
      (sum, sumFormatted) => {
        mockShowIncVat.value = false;
        const wrapper = mountConfirmation({
          summary: {
            ...mockSummary,
            total: { ...mockSummary.total, sum, sumFormatted },
          },
        });

        expect(wrapper.find('[data-testid="summary-to-pay"]').exists()).toBe(
          false,
        );
      },
    );

    it('keeps the VAT row the same in both modes', () => {
      mockShowIncVat.value = true;
      const inc = mountConfirmation()
        .find('[data-testid="summary-vat"]')
        .text();
      mockShowIncVat.value = false;
      const ex = mountConfirmation().find('[data-testid="summary-vat"]').text();

      expect(ex).toBe(inc);
    });

    it('shows no amount rather than the inc one when the ex amounts are missing', () => {
      mockShowIncVat.value = false;
      const summary = {
        ...mockSummary,
        rows: [
          {
            quantity: 1,
            articleNumber: 'ART-009',
            name: 'Inc only',
            product: { name: 'Inc only' },
            price: { priceIncVat: 50, priceIncVatFormatted: '$50.00' },
          },
        ],
        total: {
          itemValueIncVat: 50,
          itemValueIncVatFormatted: '$50.00',
          sum: 50,
          sumFormatted: '$50.00',
          currency: 'SEK',
        },
      };
      const wrapper = mountConfirmation({ summary });

      expect(wrapper.find('[data-testid="items-list"]').text()).not.toContain(
        '50',
      );
      expect(wrapper.find('[data-testid="summary-subtotal"]').text()).toBe('');
      expect(
        wrapper.find('[data-testid="summary-total"]').text(),
      ).not.toContain('$50.00');
    });
  });
});
