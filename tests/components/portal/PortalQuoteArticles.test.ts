// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import { makeQuote } from '../../fixtures/quote';
import type { QuoteLineItem } from '../../../shared/types/quote';

import PortalQuoteArticles from '../../../app/components/portal/PortalQuoteArticles.vue';

const stubs = {
  ProductThumbnail: { template: '<span data-testid="thumb" />' },
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
});
