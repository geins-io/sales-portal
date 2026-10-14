import { describe, it, expect, beforeEach } from 'vitest';
import { mockShowIncVat } from '../../setup-components';
import { mountComponent } from '../../utils/component';
import OrderItemsTable from '../../../app/components/portal/OrderItemsTable.vue';
import OrderSummaryCard from '../../../app/components/portal/OrderSummaryCard.vue';
import OrderAddresses from '../../../app/components/portal/OrderAddresses.vue';

const amounts = {
  subtotal: '240 kr',
  shipping: '50 kr',
  paymentFee: '20 kr',
  tax: '62 kr',
  total: '310 kr',
  totalIncVat: '372 kr',
};

const rows = [
  {
    key: 'row-0',
    name: 'Widget',
    articleNumber: 'ART-1',
    quantity: 2,
    unitPriceFormatted: '100 kr',
    totalPriceFormatted: '200 kr',
    imageFileName: null,
    alias: 'widget',
  },
  {
    key: 'row-1',
    name: 'Cabinet',
    quantity: 1,
    unitPriceFormatted: '40 kr',
    totalPriceFormatted: '40 kr',
    imageFileName: null,
    alias: 'cabinet',
    href: '/replay',
    configuration: { summary: [] },
  },
];

const stubs = {
  ProductThumbnail: { template: '<div />' },
  LineSpecification: {
    props: ['id'],
    template: '<div data-testid="line-specification" :data-id="id" />',
  },
  AddressBlock: {
    props: ['label', 'address'],
    template: '<div v-bind="$attrs">{{ address?.company }}</div>',
  },
};

const text = (wrapper: ReturnType<typeof mountComponent>, id: string) =>
  wrapper.find(`[data-testid="${id}"]`).text();

describe('OrderItemsTable', () => {
  beforeEach(() => {
    mockShowIncVat.value = false;
  });

  function mount() {
    return mountComponent(OrderItemsTable, {
      props: { items: rows, amounts, itemCount: 2 },
      global: { stubs },
    });
  }

  it('renders one row per item with its own prices', () => {
    const wrapper = mount();

    expect(wrapper.findAll('[data-testid="order-item-row"]')).toHaveLength(2);
    expect(
      wrapper
        .findAll('[data-testid="order-item-unit-price"]')
        .map((c) => c.text()),
    ).toEqual(['100 kr', '40 kr']);
    expect(
      wrapper
        .findAll('[data-testid="order-item-total-price"]')
        .map((c) => c.text()),
    ).toEqual(['200 kr', '40 kr']);
  });

  it('links a plain row to its product and a configured row to its replay', () => {
    const links = mount()
      .findAll('[data-testid="order-item-name-link"]')
      .map((a) => a.attributes('href'));

    expect(links).toEqual(['/se/en/p/widget', '/replay']);
  });

  it('shows the configured row its specification', () => {
    const specs = mount().findAll('[data-testid="line-specification"]');

    expect(specs.map((s) => s.attributes('data-id'))).toEqual([
      'order-item-configuration-1',
    ]);
  });

  it('carries the totals in its footer', () => {
    const wrapper = mount();

    expect(text(wrapper, 'order-items-footer-shipping')).toBe('50 kr');
    expect(text(wrapper, 'order-items-footer-payment-fee')).toBe('20 kr');
    expect(text(wrapper, 'order-items-footer-total')).toBe('310 kr');
    expect(text(wrapper, 'order-items-footer-total-inc-vat')).toBe('372 kr');
  });
});

describe('OrderSummaryCard', () => {
  it('shows each amount it is given', () => {
    const wrapper = mountComponent(OrderSummaryCard, {
      props: { amounts, itemCount: 2 },
    });

    expect(text(wrapper, 'order-summary-subtotal')).toBe('240 kr');
    expect(text(wrapper, 'order-summary-shipping')).toBe('50 kr');
    expect(text(wrapper, 'order-summary-payment-fee')).toBe('20 kr');
    expect(text(wrapper, 'order-summary-tax')).toBe('62 kr');
    expect(text(wrapper, 'order-summary-total')).toBe('310 kr');
    expect(text(wrapper, 'order-summary-total-inc-vat')).toBe('372 kr');
  });

  it('shows no fee or inc line it is not given', () => {
    const wrapper = mountComponent(OrderSummaryCard, {
      props: { amounts: { subtotal: '1', tax: '2', total: '3' }, itemCount: 1 },
    });

    for (const id of [
      'order-summary-shipping',
      'order-summary-payment-fee',
      'order-summary-total-inc-vat',
    ]) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists(), id).toBe(false);
    }
  });
});

describe('OrderAddresses', () => {
  it('shows both addresses and the additional information', () => {
    const wrapper = mountComponent(OrderAddresses, {
      props: {
        billingAddress: { company: 'Acme' },
        shippingAddress: { company: 'Warehouse' },
        customerOrderNumber: 'PO-7',
        goodsLabel: 'Dock 4',
        desiredDeliveryDate: '2026-10-20T00:00:00',
      },
      global: { stubs },
    });

    expect(text(wrapper, 'billing-address')).toBe('Acme');
    expect(text(wrapper, 'shipping-address')).toBe('Warehouse');
    expect(text(wrapper, 'additional-your-reference')).toContain('PO-7');
    expect(text(wrapper, 'additional-goods-label')).toContain('Dock 4');
    expect(text(wrapper, 'additional-delivery-date')).toContain('2026-10-20');
  });

  it('renders nothing without addresses or information', () => {
    const wrapper = mountComponent(OrderAddresses, {
      props: {},
      global: { stubs },
    });

    expect(wrapper.html()).not.toContain('billing-address');
    expect(wrapper.find('[data-testid="order-additional-info"]').exists()).toBe(
      false,
    );
  });
});
