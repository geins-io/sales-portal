import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import OrderConfirmation from '../../../app/components/checkout/OrderConfirmation.vue';

const mockSummary = {
  orderId: 'ORD-215',
  rows: [
    {
      quantity: 2,
      articleNumber: 'ART-001',
      name: 'Widget A',
      product: {
        name: 'Widget A',
        brand: 'Acme',
        imageUrl: 'https://cdn.example.com/widget-a.jpg',
        productUrl: '/products/widget-a',
      },
      price: {
        priceIncVat: 89.99,
        priceIncVatFormatted: '$89.99',
        discountIncVat: 0,
        discountIncVatFormatted: '$0.00',
      },
    },
    {
      quantity: 1,
      articleNumber: 'ART-002',
      name: 'Gadget B',
      product: {
        name: 'Gadget B',
        brand: 'Acme',
        imageUrl: 'https://cdn.example.com/gadget-b.jpg',
        productUrl: '/products/gadget-b',
      },
      price: {
        priceIncVat: 49.5,
        priceIncVatFormatted: '$49.50',
        discountIncVat: 0,
        discountIncVatFormatted: '$0.00',
      },
    },
    {
      quantity: 3,
      articleNumber: 'ART-003',
      name: 'Doohickey C',
      product: {
        name: 'Doohickey C',
        brand: 'Beta',
        imageUrl: '',
        productUrl: '/products/doohickey-c',
      },
      price: {
        priceIncVat: 19.99,
        priceIncVatFormatted: '$19.99',
        discountIncVat: 0,
        discountIncVatFormatted: '$0.00',
      },
    },
  ],
  total: {
    itemValueIncVat: 289.45,
    itemValueIncVatFormatted: '$289.45',
    orderValueIncVat: 299.45,
    orderValueIncVatFormatted: '$299.45',
    shippingFeeIncVat: 10,
    shippingFeeIncVatFormatted: '$10.00',
    discountIncVat: 0,
    discountIncVatFormatted: '$0.00',
    sum: 299.45,
    sumFormatted: '$299.45',
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
      error: null,
      ...props,
    },
  });
}

describe('OrderConfirmation', () => {
  it('renders thank-you message', () => {
    const wrapper = mountConfirmation();
    expect(wrapper.text()).toContain('order_confirmation.thank_you');
  });

  it('displays order number', () => {
    const wrapper = mountConfirmation();
    const orderNumber = wrapper.find('[data-testid="order-number"]');
    expect(orderNumber.exists()).toBe(true);
    expect(orderNumber.text()).toContain('ORD-215');
  });

  it('renders items table with rows', () => {
    const wrapper = mountConfirmation();
    const table = wrapper.find('[data-testid="items-table"]');
    expect(table.exists()).toBe(true);
    const rows = table.findAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('shows product name and article number', () => {
    const wrapper = mountConfirmation();
    const table = wrapper.find('[data-testid="items-table"]');
    expect(table.text()).toContain('Widget A');
    expect(table.text()).toContain('ART-001');
  });

  it('shows quantity and price', () => {
    const wrapper = mountConfirmation();
    const table = wrapper.find('[data-testid="items-table"]');
    expect(table.text()).toContain('2');
    expect(table.text()).toContain('$89.99');
  });

  it('shows summary subtotal', () => {
    const wrapper = mountConfirmation();
    expect(wrapper.text()).toContain('$289.45');
  });

  it('shows summary total', () => {
    const wrapper = mountConfirmation();
    const total = wrapper.find('[data-testid="summary-total"]');
    expect(total.exists()).toBe(true);
    expect(total.text()).toContain('$299.45');
  });

  it('shows shipping fee', () => {
    const wrapper = mountConfirmation();
    expect(wrapper.text()).toContain('$10.00');
  });

  it('hides discount line when no discount', () => {
    const wrapper = mountConfirmation();
    expect(wrapper.find('[data-testid="summary-discount"]').exists()).toBe(
      false,
    );
  });

  it('shows discount line when discount exists', () => {
    const summaryWithDiscount = {
      ...mockSummary,
      total: {
        ...mockSummary.total,
        discountIncVat: 20,
        discountIncVatFormatted: '$20.00',
      },
    };
    const wrapper = mountConfirmation({ summary: summaryWithDiscount });
    const discount = wrapper.find('[data-testid="summary-discount"]');
    expect(discount.exists()).toBe(true);
    expect(discount.text()).toContain('$20.00');
  });

  it('shows billing address', () => {
    const wrapper = mountConfirmation();
    const billing = wrapper.find('[data-testid="billing-address"]');
    expect(billing.exists()).toBe(true);
    expect(billing.text()).toContain('John Doe');
    expect(billing.text()).toContain('123 Main St');
    expect(billing.text()).toContain('Stockholm');
  });

  it('shows shipping address', () => {
    const wrapper = mountConfirmation();
    const shipping = wrapper.find('[data-testid="shipping-address"]');
    expect(shipping.exists()).toBe(true);
    expect(shipping.text()).toContain('Jane Smith');
    expect(shipping.text()).toContain('456 Oak Ave');
    expect(shipping.text()).toContain('Gothenburg');
  });

  it('shows continue shopping link', () => {
    const wrapper = mountConfirmation();
    const link = wrapper.find('a[href="/"]');
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain('order_confirmation.continue_shopping');
  });

  it('shows view orders link', () => {
    const wrapper = mountConfirmation();
    const link = wrapper.find('a[href="/portal/orders"]');
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain('order_confirmation.view_orders');
  });

  it('shows loading state', () => {
    const wrapper = mountConfirmation({ isLoading: true, summary: null });
    expect(
      wrapper.find('[data-testid="order-confirmation-loading"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="items-table"]').exists()).toBe(false);
  });

  it('shows error state', () => {
    const wrapper = mountConfirmation({
      error: 'Something went wrong',
      summary: null,
    });
    expect(
      wrapper.find('[data-testid="order-confirmation-error"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain('Something went wrong');
  });

  it('handles empty rows', () => {
    const summaryNoRows = { ...mockSummary, rows: [] };
    const wrapper = mountConfirmation({ summary: summaryNoRows });
    expect(wrapper.find('[data-testid="items-table"]').exists()).toBe(true);
    const rows = wrapper
      .find('[data-testid="items-table"]')
      .findAll('tbody tr');
    expect(rows.length).toBe(0);
  });

  it('handles missing addresses gracefully', () => {
    const summaryNoAddresses = {
      ...mockSummary,
      billingAddress: undefined,
      shippingAddress: undefined,
    };
    const wrapper = mountConfirmation({ summary: summaryNoAddresses });
    expect(wrapper.find('[data-testid="billing-address"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="shipping-address"]').exists()).toBe(
      false,
    );
  });
});
