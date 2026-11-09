// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import { makeConfiguredQuoteLine, makeQuote } from '../../fixtures/quote';
import type { QuoteLineItem } from '../../../shared/types/quote';

import PortalQuoteArticles from '../../../app/components/portal/PortalQuoteArticles.vue';

const stubs = {
  ProductThumbnail: { template: '<span data-testid="thumb" />' },
  LineSpecification: {
    name: 'LineSpecification',
    props: [
      'id',
      'productName',
      'quantity',
      'configuration',
      'unitPrice',
      'totalPrice',
    ],
    template: '<div data-testid="line-specification" :data-id="id" />',
  },
};

const lines = (): QuoteLineItem[] => makeQuote().lineItems;

function mount(items: QuoteLineItem[], slots: Record<string, string> = {}) {
  return mountComponent(PortalQuoteArticles, {
    props: { items },
    slots,
    global: { stubs },
  });
}

describe('PortalQuoteArticles', () => {
  it('titles the card "Artiklar"', () => {
    const wrapper = mount(lines());

    expect(wrapper.find('[data-testid="quote-articles"]').text()).toContain(
      'portal.quotations.items_heading',
    );
  });

  it('lists the lines in the read-only table', () => {
    const wrapper = mount(lines());

    expect(wrapper.findAll('[data-testid="line-item-row"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-testid="line-item-card"]')).toHaveLength(1);
    expect(wrapper.find('input').exists()).toBe(false);
  });

  it("heads the table with the prototype's columns", () => {
    const wrapper = mount(lines());

    expect(
      wrapper
        .findAll('[data-testid="line-items-table"] th')
        .map((th) => th.text()),
    ).toEqual([
      'portal.quotations.col_item',
      'portal.quotations.col_article',
      'portal.quotations.quantity',
      'portal.quotations.col_unit_price',
      'portal.quotations.line_total',
    ]);
  });

  it('shows the empty slot and no table without lines', () => {
    const wrapper = mount([], {
      empty: '<p data-testid="empty-note">Empty</p>',
    });

    expect(wrapper.find('[data-testid="empty-note"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="line-items-table"]').exists()).toBe(
      false,
    );
  });

  it('leaves the empty slot out when there are lines', () => {
    const wrapper = mount(lines(), {
      empty: '<p data-testid="empty-note">Empty</p>',
    });

    expect(wrapper.find('[data-testid="empty-note"]').exists()).toBe(false);
  });

  describe('a configured line', () => {
    const configured = () => makeConfiguredQuoteLine();
    const plain = () => lines()[0]!;

    it('shows its specification in the table and on the card', () => {
      const line = configured();
      const wrapper = mount([plain(), line]);

      const specs = wrapper.findAllComponents({ name: 'LineSpecification' });
      expect(specs.map((spec) => spec.props('id'))).toEqual([
        'quote-item-configuration-1',
        'quote-item-configuration-m-1',
      ]);
      for (const spec of specs) {
        expect(spec.props()).toEqual({
          id: spec.props('id'),
          productName: 'Configured Display',
          quantity: 1,
          configuration: line.configuration,
          unitPrice: line.linePrices!.unit,
          totalPrice: line.linePrices!.total,
        });
      }
    });

    it('says it is configured, in the table row and on the card', () => {
      const wrapper = mount([plain(), configured()]);

      const [plainRow, configuredRow] = wrapper.findAll(
        '[data-testid="line-item-row"]',
      );
      const [plainCard, configuredCard] = wrapper.findAll(
        '[data-testid="line-item-card"]',
      );
      for (const part of [configuredRow!, configuredCard!]) {
        expect(part.find('[data-testid="line-item-configured"]').text()).toBe(
          'cart.configured_product',
        );
      }
      for (const part of [plainRow!, plainCard!]) {
        expect(part.find('[data-testid="line-item-configured"]').exists()).toBe(
          false,
        );
        expect(part.find('[data-testid="line-specification"]').exists()).toBe(
          false,
        );
      }
    });

    it('tops the configured row, whose specification makes it tall', () => {
      const [plainRow, configuredRow] = mount([plain(), configured()]).findAll(
        '[data-testid="line-item-row"]',
      );

      expect(configuredRow!.classes()).toContain('align-top');
      expect(plainRow!.classes()).not.toContain('align-top');
    });

    it('keeps its unit price and total, as order rows do', () => {
      const wrapper = mount([configured()]);

      expect(wrapper.find('[data-testid="line-item-unit-price"]').text()).toBe(
        '29 256,70 kr',
      );
      expect(wrapper.find('[data-testid="line-item-total-price"]').text()).toBe(
        '29 256,70 kr',
      );
    });

    it('still opens a specification when Geins sent no configuration', () => {
      const line = configured();
      line.configuration = { configurationId: 'config-1', summary: [] };
      delete line.linePrices;

      const specs = mount([line]).findAllComponents({
        name: 'LineSpecification',
      });

      expect(specs).toHaveLength(2);
      expect(specs[0]!.props('configuration')).toEqual({
        configurationId: 'config-1',
        summary: [],
      });
    });

    it('keeps the name as plain text, with no link to reopen it', () => {
      const wrapper = mount([configured()]);

      expect(wrapper.find('[data-testid="line-item-name-link"]').exists()).toBe(
        false,
      );
      expect(
        wrapper.findAll('[data-testid="line-item-name"]').map((n) => n.text()),
      ).toEqual(['Configured Display', 'Configured Display']);
    });

    it('renders two configurations of one SKU as two lines', () => {
      const wrapper = mount([
        configured(),
        makeConfiguredQuoteLine({
          configuration: {
            configurationId: 'config-2',
            summary: [{ label: 'Display', value: '65"' }],
          },
        }),
      ]);

      expect(wrapper.findAll('[data-testid="line-item-row"]')).toHaveLength(2);
      expect(wrapper.findAll('[data-testid="line-item-card"]')).toHaveLength(2);
      expect(
        wrapper
          .findAllComponents({ name: 'LineSpecification' })
          .map((spec) => spec.props('configuration').configurationId),
      ).toEqual(['config-1', 'config-2', 'config-1', 'config-2']);
    });
  });
});
