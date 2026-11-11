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

  it('shows a configured line with its specification and an amount to change, as a plain line', async () => {
    const wrapper = mount([plain, configured]);
    const row = desktopRow(wrapper, 1);

    const amount = row.find('[data-testid="quote-quantity"]');
    expect(amount.attributes('aria-label')).toBe(
      'portal.quotations.quantity, Display wall',
    );
    await amount.setValue('7');
    expect(wrapper.emitted('quantity')).toEqual([[configured, 7]]);
    const spec = wrapper.find('[data-testid="line-spec"]');
    expect(spec.text()).toBe('55"');
    expect(spec.attributes('data-quantity')).toBe('3');
    expect(spec.attributes('data-total')).toBe('300');
  });

  describe('opening a configured line in the configurator', () => {
    const QUOTE_ID = '01a1cae6-ce08-7ea7-859d-4af6b1cb6832';
    const withPage = { ...configured, canonicalUrl: '/displays/display-wall' };
    const href = `/se/en/p/displays/display-wall?quote=${QUOTE_ID}&quoteLine=line-c`;
    const mountOn = (lines: QuoteLineItem[]) =>
      mountComponent(PortalQuoteDraftTable, {
        props: { lines, totals, quoteId: QUOTE_ID },
        global: { stubs },
      });

    it('links its name and "Ändra konfiguration" to the product\'s configurator, naming the draft and the line', () => {
      const wrapper = mountOn([plain, withPage]);
      const row = desktopRow(wrapper, 1);

      expect(
        row.find('[data-testid="quote-item-name"]').attributes('href'),
      ).toBe(href);
      const change = wrapper
        .find('[data-testid="quote-item-configuration-row"]')
        .find('[data-testid="quote-item-edit-configuration"]');
      expect(change.text()).toBe('cart.edit_configuration');
      expect(change.attributes('href')).toBe(href);
      const card = wrapper.findAll('[data-testid="quote-item-card"]')[1]!;
      expect(
        card
          .find('[data-testid="quote-item-edit-configuration"]')
          .attributes('href'),
      ).toBe(href);
    });

    it('puts "Visa konfiguration" and "Ändra konfiguration" side by side in one row, as the cart does, in both layouts', () => {
      const wrapper = mountOn([withPage]);
      const rows = wrapper.findAll(
        '[data-testid="quote-item-configuration-actions"]',
      );

      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.classes()).toEqual(
          expect.arrayContaining(['flex', 'flex-wrap', 'gap-2']),
        );
        const actions = row.element.children;
        expect(actions).toHaveLength(2);
        expect(actions[0]!.getAttribute('data-testid')).toBe('line-spec');
        expect(actions[1]!.getAttribute('data-testid')).toBe(
          'quote-item-edit-configuration',
        );
      }
    });

    it('puts the row under the image and name, as an order row does, in a row of its own across every column, so it never widens one', () => {
      const wrapper = mountOn([plain, withPage]);
      const columns = wrapper.findAll('thead th').length;
      const line = desktopRow(wrapper, 1);
      const subRow = wrapper.find(
        '[data-testid="quote-item-configuration-row"]',
      );

      expect(line.element.nextElementSibling).toBe(subRow.element);
      expect(line.classes()).toEqual(
        expect.arrayContaining(['align-top', 'border-b-0']),
      );
      expect(desktopRow(wrapper, 0).classes()).not.toContain('align-top');
      expect(line.find('td > div').classes()).not.toContain('min-h-20');
      expect(desktopRow(wrapper, 0).find('td > div').classes()).toContain(
        'min-h-20',
      );
      expect(
        line.find('[data-testid="quote-item-configuration-actions"]').exists(),
      ).toBe(false);
      const cells = subRow.findAll('td');
      expect(cells).toHaveLength(1);
      expect(cells[0]!.attributes('colspan')).toBe(String(columns));
      const actions = subRow.find(
        '[data-testid="quote-item-configuration-actions"]',
      );
      expect(actions.classes()).toContain('pl-13');
      for (const forcing of [
        'w-max',
        'w-fit',
        'whitespace-nowrap',
        'flex-nowrap',
      ]) {
        expect(actions.classes()).not.toContain(forcing);
      }
    });

    it('puts the row last in the card, under the amount, as the cart does', () => {
      const card = mountOn([withPage]).find('[data-testid="quote-item-card"]');

      expect(card.element.lastElementChild?.getAttribute('data-testid')).toBe(
        'quote-item-configuration-actions',
      );
    });

    it('says a configured line is configured under its name in the card, as the cart does', () => {
      const card = mountOn([plain, withPage]).findAll(
        '[data-testid="quote-item-card"]',
      );

      expect(
        card[1]!.find('[data-testid="quote-item-configured"]').text(),
      ).toBe('cart.configured_product');
      expect(card[1]!.text()).toMatch(/ART-001\s+•\s+cart\.configured_product/);
      expect(
        card[0]!.find('[data-testid="quote-item-configured"]').exists(),
      ).toBe(false);
    });

    it('offers no change for a plain line', () => {
      const wrapper = mountOn([plain, withPage]);

      expect(
        desktopRow(wrapper, 0)
          .find('[data-testid="quote-item-configuration-actions"]')
          .exists(),
      ).toBe(false);
    });

    it('offers no change without the product page or the draft, and the name is plain text', () => {
      for (const wrapper of [mountOn([configured]), mount([withPage])]) {
        const row = desktopRow(wrapper, 0);
        expect(
          wrapper
            .find('[data-testid="quote-item-edit-configuration"]')
            .exists(),
        ).toBe(false);
        expect(
          row.find('[data-testid="quote-item-name"]').attributes('href'),
        ).toBeUndefined();
      }
    });
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
      true,
    );
    expect(cards[1]!.find('[data-testid="line-spec"]').exists()).toBe(true);
  });
});
