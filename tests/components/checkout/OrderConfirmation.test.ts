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

  it('renders payment method label when paymentMethod prop is set', () => {
    const wrapper = mountConfirmation({ paymentMethod: 'invoice' });
    const label = wrapper.find('[data-testid="payment-label"]');
    expect(label.exists()).toBe(true);
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

  it('renders full-width view-order CTA pointing to /portal/orders/<orderId>', () => {
    const wrapper = mountConfirmation();
    const cta = wrapper.find('[data-testid="view-order-cta"]');
    expect(cta.exists()).toBe(true);
    expect(cta.attributes('href')).toBe('/se/en/portal/orders/ORD-215');
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
