import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { mockShowIncVat } from '../../setup-components';
import { mountComponent } from '../../utils/component';
import OrderItemsTable from '../../../app/components/portal/OrderItemsTable.vue';
import OrderSummaryCard from '../../../app/components/portal/OrderSummaryCard.vue';
import OrderAddresses from '../../../app/components/portal/OrderAddresses.vue';
import { summaryRows } from '../../../app/utils/summary-rows';
import type { OrderAmounts } from '../../../app/utils/order-view';

// The tenant hides prices: the parts must not read it, the caller decides.
const mockShowPrice = ref(false);
vi.mock('../../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: mockShowPrice }),
}));

/** The rows the pages build, on the ex side as `mockShowIncVat` starts. */
const summary = (a: OrderAmounts, totalIncVatLabel = 'X') =>
  summaryRows(a, 2, false, (key) => key, { totalIncVatLabel });

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
      props: { items: rows, rows: summary(amounts), showPrices: true },
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

describe('the summary rows the decision adds', () => {
  const withDiscount = { ...amounts, discount: '25 kr' };

  it('shows the discount as a deduction in the card and the table footer', () => {
    const card = mountComponent(OrderSummaryCard, {
      props: { rows: summary(withDiscount), showPrices: true },
    });
    const table = mountComponent(OrderItemsTable, {
      props: { items: rows, rows: summary(withDiscount), showPrices: true },
      global: { stubs },
    });

    expect(text(card, 'order-summary-discount')).toContain('-25 kr');
    expect(text(table, 'order-items-footer-discount')).toBe('-25 kr');
  });

  it('lists the discount right after the subtotal, as the cart does', () => {
    const card = mountComponent(OrderSummaryCard, {
      props: { rows: summary(withDiscount), showPrices: true },
    });
    const order = [...card.element.querySelectorAll('[data-testid]')]
      .map((el) => el.getAttribute('data-testid'))
      .filter(
        (id) => id?.startsWith('order-summary-') && id !== 'order-summary',
      );

    expect(order).toEqual([
      'order-summary-subtotal',
      'order-summary-discount',
      'order-summary-shipping',
      'order-summary-payment-fee',
      'order-summary-tax',
      'order-summary-total',
      'order-summary-total-inc-vat',
    ]);
  });

  it('shows no discount row without a discount', () => {
    const card = mountComponent(OrderSummaryCard, {
      props: { rows: summary(amounts), showPrices: true },
    });

    expect(card.find('[data-testid="order-summary-discount"]').exists()).toBe(
      false,
    );
  });

  it('labels the inc-VAT line with the text it is given', () => {
    const card = mountComponent(OrderSummaryCard, {
      props: {
        rows: summary(amounts, 'Att betala inkl. moms'),
        showPrices: true,
      },
    });
    const table = mountComponent(OrderItemsTable, {
      props: {
        items: rows,
        rows: summary(amounts, 'Att betala inkl. moms'),
        showPrices: true,
      },
      global: { stubs },
    });

    expect(
      card.find('[data-testid="order-summary-total-inc-vat"]').element
        .previousElementSibling?.textContent,
    ).toBe('Att betala inkl. moms');
    expect(
      table
        .find('[data-testid="order-items-footer-total-inc-vat"]')
        .element.previousElementSibling?.textContent?.trim(),
    ).toBe('Att betala inkl. moms');
  });

  it('shows the payment method in the additional information', () => {
    const wrapper = mountComponent(OrderAddresses, {
      props: { paymentMethod: 'Faktura 30 dagar' },
      global: { stubs },
    });

    expect(text(wrapper, 'additional-payment-method')).toBe(
      'portal.orders.detail.additional_info.payment_method: Faktura 30 dagar',
    );
  });
});

describe('OrderSummaryCard', () => {
  it('shows each amount it is given', () => {
    const wrapper = mountComponent(OrderSummaryCard, {
      props: { rows: summary(amounts), showPrices: true },
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
      props: {
        rows: summary({ subtotal: '1', tax: '2', total: '3' }),
        showPrices: true,
      },
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

describe('an order where prices are hidden', () => {
  const allAmounts = [
    '240 kr',
    '50 kr',
    '20 kr',
    '62 kr',
    '310 kr',
    '372 kr',
    '100 kr',
    '200 kr',
    '40 kr',
  ];

  afterEach(() => {
    mockShowPrice.value = false;
  });

  function mountTable(showPrices: boolean) {
    return mountComponent(OrderItemsTable, {
      props: { items: rows, rows: summary(amounts), showPrices },
      global: { stubs },
    });
  }

  it('shows the price columns and the totals footer where prices are shown', () => {
    const wrapper = mountTable(true);

    expect(wrapper.text()).toContain('portal.quotations.col_unit_price');
    expect(wrapper.text()).toContain('portal.quotations.line_total');
    expect(
      wrapper.findAll('[data-testid="order-item-unit-price"]'),
    ).toHaveLength(2);
    expect(wrapper.find('[data-testid="order-items-footer"]').exists()).toBe(
      true,
    );
  });

  it('keeps the rows in the table but no price column and no totals', () => {
    mockShowPrice.value = true;
    const wrapper = mountTable(false);

    expect(wrapper.findAll('[data-testid="order-item-row"]')).toHaveLength(2);
    expect(
      wrapper
        .findAll('[data-testid="order-item-quantity"]')
        .map((c) => c.text()),
    ).toEqual(['2', '1']);
    expect(wrapper.text()).toContain('Widget');
    expect(wrapper.text()).not.toContain('portal.quotations.col_unit_price');
    expect(wrapper.find('[data-testid="order-item-unit-price"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="order-item-total-price"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="order-items-footer"]').exists()).toBe(
      false,
    );
    for (const amount of allAmounts) {
      expect(wrapper.text()).not.toContain(amount);
    }
  });

  it('shows the summary card where prices are shown', () => {
    const wrapper = mountComponent(OrderSummaryCard, {
      props: { rows: summary(amounts), showPrices: true },
    });

    expect(wrapper.find('[data-testid="order-summary"]').exists()).toBe(true);
  });

  it('shows no summary card, which holds only amounts', () => {
    mockShowPrice.value = true;
    const wrapper = mountComponent(OrderSummaryCard, {
      props: { rows: summary(amounts), showPrices: false },
    });

    expect(wrapper.find('[data-testid="order-summary"]').exists()).toBe(false);
    for (const amount of allAmounts) {
      expect(wrapper.text()).not.toContain(amount);
    }
  });
});

describe('what a quotation asks of the order parts', () => {
  it('heads the card and the table with the text they are given, the order wording by default', () => {
    const card = mountComponent(OrderSummaryCard, {
      props: { rows: summary(amounts), showPrices: true },
    });
    const titled = mountComponent(OrderSummaryCard, {
      props: { rows: summary(amounts), showPrices: true, title: 'Offert' },
    });
    const table = mountComponent(OrderItemsTable, {
      props: { items: rows, rows: summary(amounts), showPrices: true },
      global: { stubs },
    });
    const titledTable = mountComponent(OrderItemsTable, {
      props: {
        items: rows,
        rows: summary(amounts),
        showPrices: true,
        title: 'Artiklar',
      },
      global: { stubs },
    });

    expect(card.find('h3').text()).toBe('portal.orders.detail.summary.title');
    expect(titled.find('h3').text()).toBe('Offert');
    expect(table.find('h3').text()).toBe('portal.orders.detail.items.title');
    expect(titledTable.find('h3').text()).toBe('Artiklar');
  });

  it('renders every row it is given, the discount with its own label', () => {
    const given = summaryRows(
      { ...amounts, discount: '25 kr' },
      2,
      false,
      (key) => key,
      { totalIncVatLabel: 'X', discountLabel: 'Rabatt 5 %' },
    );
    const card = mountComponent(OrderSummaryCard, {
      props: { rows: given, showPrices: true },
    });
    const table = mountComponent(OrderItemsTable, {
      props: { items: rows, rows: given, showPrices: true },
      global: { stubs },
    });

    expect(card.find('[data-testid="order-summary-discount"]').text()).toBe(
      'Rabatt 5 %-25 kr',
    );
    expect(
      table
        .find('[data-testid="order-items-footer-discount"]')
        .element.previousElementSibling?.textContent?.trim(),
    ).toBe('Rabatt 5 %');
  });

  it('shows a shipping note as the shipping value', () => {
    const given = summaryRows(
      { subtotal: '1', tax: '2', total: '3' },
      1,
      true,
      (key) => key,
      { totalIncVatLabel: 'X', shippingNote: 'Anges i offerten' },
    );
    const card = mountComponent(OrderSummaryCard, {
      props: { rows: given, showPrices: true },
    });
    const table = mountComponent(OrderItemsTable, {
      props: { items: rows, rows: given, showPrices: true },
      global: { stubs },
    });

    expect(text(card, 'order-summary-shipping')).toBe('Anges i offerten');
    expect(text(table, 'order-items-footer-shipping')).toBe('Anges i offerten');
  });

  it('shows prices where told to, although the tenant hides them', () => {
    mockShowPrice.value = false;
    const card = mountComponent(OrderSummaryCard, {
      props: { rows: summary(amounts), showPrices: true },
    });
    const table = mountComponent(OrderItemsTable, {
      props: { items: rows, rows: summary(amounts), showPrices: true },
      global: { stubs },
    });

    expect(text(card, 'order-summary-total')).toBe('310 kr');
    expect(table.findAll('[data-testid="order-item-unit-price"]')).toHaveLength(
      2,
    );
    expect(text(table, 'order-items-footer-total')).toBe('310 kr');
  });

  it('puts what goes beside the heading and under the rows inside the card', () => {
    const card = mountComponent(OrderSummaryCard, {
      props: { rows: summary(amounts), showPrices: true },
      slots: {
        'heading-aside': '<span data-testid="aside">≈</span>',
        default: '<button data-testid="action">Accept</button>',
      },
    });
    const root = card.find('[data-testid="order-summary"]');

    expect(root.find('[data-testid="aside"]').exists()).toBe(true);
    expect(
      root.find('[data-testid="aside"]').element.previousElementSibling
        ?.tagName,
    ).toBe('H3');
    expect(root.find('[data-testid="action"]').exists()).toBe(true);
    // Under the rows: after the total.
    const total = root.find('[data-testid="order-summary-total"]').element;
    const action = root.find('[data-testid="action"]').element;
    expect(
      total.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  it('shows the payment terms it is given in the additional information', () => {
    const wrapper = mountComponent(OrderAddresses, {
      props: { paymentTerms: '30 dagar netto' },
      global: { stubs },
    });

    expect(text(wrapper, 'additional-payment-terms')).toBe(
      'portal.quotations.payment_terms: 30 dagar netto',
    );
  });

  it('has no payment terms line without terms', () => {
    const wrapper = mountComponent(OrderAddresses, {
      props: { paymentMethod: 'Invoice', paymentTerms: '' },
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="additional-payment-terms"]').exists(),
    ).toBe(false);
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
