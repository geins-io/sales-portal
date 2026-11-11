// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { QuoteLineItem } from '#shared/types/quote';
import type { SummaryRow } from '#shared/types/portal-rows';
import { mockShowIncVat } from '../../setup-components';
import { mountComponent } from '../../utils/component';
import { makeQuote } from '../../fixtures/quote';
import PortalQuoteDraftTable from '../../../app/components/portal/PortalQuoteDraftTable.vue';

const [base] = makeQuote().lineItems;
const plain: QuoteLineItem = {
  ...base!,
  id: 'line-a',
  skuId: 11,
  alias: 'widget-pro',
  quantity: 2,
};
const configured: QuoteLineItem = {
  ...base!,
  id: 'line-c',
  skuId: 900,
  name: 'Display wall',
  quantity: 3,
  configuration: {
    configurationId: 'cfg-1',
    summary: [{ label: 'Panel', value: '55"' }],
    sections: [],
  },
  linePrices: {
    unit: { sellingPriceIncVat: 100 } as never,
    total: { sellingPriceIncVat: 300 } as never,
  },
};
const totals: SummaryRow[] = [
  { key: 'subtotal', label: 'Delsumma', value: '200,00 kr' },
  { key: 'total', label: 'Totalt', value: '250,00 kr' },
];

const stubs = {
  PortalQuoteQuantityField: {
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    template:
      '<input data-testid="quote-quantity" :aria-label="label" :value="modelValue" @change="$emit(\'update:modelValue\', Number($event.target.value))" />',
  },
  LineSpecification: {
    props: ['id', 'quantity', 'configuration', 'unitPrice', 'totalPrice'],
    template:
      '<div data-testid="line-spec" :data-quantity="quantity" :data-total="totalPrice?.sellingPriceIncVat">{{ configuration.summary[0].value }}</div>',
  },
  ProductThumbnail: { template: '<span />' },
  TooltipProvider: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>' },
  TooltipTrigger: { template: '<div><slot /></div>' },
  TooltipContent: {
    template: '<div data-testid="tooltip"><slot /></div>',
  },
};

function mount(lines: QuoteLineItem[]) {
  return mountComponent(PortalQuoteDraftTable, {
    props: { lines, totals },
    global: { stubs },
  });
}

const desktopRow = (wrapper: ReturnType<typeof mount>, i: number) =>
  wrapper.findAll('[data-testid="quote-item-row"]')[i]!;

beforeEach(() => {
  mockShowIncVat.value = true;
});

describe('PortalQuoteDraftTable', () => {
  it('shows each line with its article number, prices, and the summary in the footer', () => {
    const wrapper = mount([plain]);
    const row = desktopRow(wrapper, 0);

    expect(row.text()).toContain('Widget Pro');
    expect(row.text()).toContain('ART-001');
    expect(row.find('[data-testid="quote-item-total"]').text()).toBe(
      '200,00 kr',
    );
    expect(row.find('a').attributes('href')).toBe('/se/en/p/widget-pro');
    expect(
      wrapper.find('[data-testid="quote-items-footer-total"]').text(),
    ).toBe('250,00 kr');
  });

  it('shows prices ex VAT when the buyer chose that', () => {
    mockShowIncVat.value = false;
    const wrapper = mount([plain]);

    expect(
      desktopRow(wrapper, 0).find('[data-testid="quote-item-total"]').text(),
    ).toBe('160,00 kr');
  });

  it('sends a typed amount on, rounded and kept within 1 to 9999', async () => {
    const wrapper = mount([plain]);
    const field = desktopRow(wrapper, 0).find('[data-testid="quote-quantity"]');

    for (const typed of ['5', '0', '12000', '3.6']) {
      await field.setValue(typed);
    }

    expect(
      wrapper
        .emitted('quantity')!
        .map(([line, qty]) => [(line as QuoteLineItem).id, qty]),
    ).toEqual([
      ['line-a', 5],
      ['line-a', 1],
      ['line-a', 9999],
      ['line-a', 4],
    ]);
  });

  it('sends nothing when the amount is what the line has', async () => {
    const wrapper = mount([plain]);

    await desktopRow(wrapper, 0)
      .find('[data-testid="quote-quantity"]')
      .setValue('2');

    expect(wrapper.emitted('quantity')).toBeUndefined();
  });

  it('names the amount field after the product', () => {
    const wrapper = mount([plain]);

    expect(
      desktopRow(wrapper, 0)
        .find('[data-testid="quote-quantity"]')
        .attributes('aria-label'),
    ).toBe('portal.quotations.quantity, Widget Pro');
  });

  it('shows a configured line with its specification and its amount locked', () => {
    const wrapper = mount([plain, configured]);
    const row = desktopRow(wrapper, 1);

    expect(row.find('[data-testid="quote-quantity"]').exists()).toBe(false);
    const locked = row.find('[data-testid="quote-item-quantity-locked"]');
    expect(locked.text()).toBe('3');
    expect(locked.attributes('title')).toBe(
      'portal.quotations.draft.configured_quantity',
    );
    const spec = row.find('[data-testid="line-spec"]');
    expect(spec.text()).toBe('55"');
    expect(spec.attributes('data-quantity')).toBe('3');
    expect(spec.attributes('data-total')).toBe('300');
  });

  it('removes a line, a configured one too', async () => {
    const wrapper = mount([plain, configured]);

    await desktopRow(wrapper, 1)
      .find('[data-testid="quote-item-remove"]')
      .trigger('click');
    await wrapper
      .findAll('[data-testid="quote-item-remove-mobile"]')[0]!
      .trigger('click');

    expect(
      wrapper.emitted('remove')!.map(([line]) => (line as QuoteLineItem).id),
    ).toEqual(['line-c', 'line-a']);
  });

  it('lets the last line be removed too: the page asks what that means', async () => {
    const wrapper = mount([plain]);
    const button = desktopRow(wrapper, 0).find(
      '[data-testid="quote-item-remove"]',
    );

    expect(button.attributes('disabled')).toBeUndefined();
    await button.trigger('click');
    expect(wrapper.emitted('remove')).toHaveLength(1);
  });

  it('gives each line a card below md, with the same controls', () => {
    const wrapper = mount([plain, configured]);
    const cards = wrapper.findAll('[data-testid="quote-item-card"]');

    expect(cards).toHaveLength(2);
    expect(cards[0]!.find('[data-testid="quote-quantity"]').exists()).toBe(
      true,
    );
    expect(cards[1]!.find('[data-testid="quote-quantity"]').exists()).toBe(
      false,
    );
    expect(cards[1]!.find('[data-testid="line-spec"]').exists()).toBe(true);
  });
});
