import { describe, it, expect, vi } from 'vitest';
import { mountComponent } from '../../utils/component';
import PortalItemRowsSheet from '../../../app/components/portal/PortalItemRowsSheet.vue';

// Stub the Sheet primitives so the (otherwise portalled, closed) content
// renders inline for assertion, mirroring ProductFilters.test.ts.
vi.mock('../../../app/components/ui/sheet', () => ({
  Sheet: { template: '<div><slot /></div>', props: ['open'] },
  SheetContent: {
    template: '<div data-testid="item-rows-sheet"><slot /></div>',
    props: ['side'],
  },
  SheetHeader: { template: '<div><slot /></div>' },
  SheetTitle: { template: '<div data-testid="sheet-title"><slot /></div>' },
}));

const items = [
  {
    key: 'a',
    name: 'Widget A',
    articleNumber: 'ART-1',
    quantity: 2,
    unitPriceFormatted: '100 kr',
    totalPriceFormatted: '200 kr',
    imageFileName: null,
    alias: 'widget-a',
  },
  {
    key: 'b',
    name: 'Widget B',
    articleNumber: 'ART-2',
    quantity: 1,
    unitPriceFormatted: '50 kr',
    totalPriceFormatted: '50 kr',
    imageFileName: null,
    alias: null,
  },
];

const totals = [
  { label: 'Subtotal (3 items)', value: '250 kr' },
  { label: 'Total', value: '250 kr', emphasis: true },
];

const stubs = {
  ProductThumbnail: {
    template: '<img data-testid="thumb" />',
    props: ['fileName', 'alt'],
  },
};

function mountSheet(props: Record<string, unknown> = {}) {
  return mountComponent(PortalItemRowsSheet, {
    props: {
      items,
      totals,
      triggerLabel: 'View order rows',
      title: 'Order items',
      ...props,
    },
    global: { stubs },
  });
}

describe('PortalItemRowsSheet', () => {
  it('renders the trigger with the given label', () => {
    const trigger = mountSheet().find('[data-testid="view-rows-trigger"]');
    expect(trigger.exists()).toBe(true);
    expect(trigger.text()).toContain('View order rows');
  });

  it('renders one row per item with name, article number and quantity', () => {
    const rows = mountSheet().findAll('[data-testid="item-rows-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain('Widget A');
    expect(rows[0]!.text()).toContain('ART-1');
    expect(rows[0]!.text()).toContain('2');
  });

  it('links the item name when an alias is present, plain text otherwise', () => {
    const rows = mountSheet().findAll('[data-testid="item-rows-row"]');
    expect(rows[0]!.find('a').exists()).toBe(true);
    expect(rows[1]!.find('a').exists()).toBe(false);
  });

  it('links the name to the href the row carries, before its product page', () => {
    const rows = mountSheet({
      items: [
        { ...items[0]!, href: '/se/sv/p/widget-a?order=o-1&row=0' },
        {
          ...items[1]!,
          alias: 'widget-b',
          href: '/se/sv/p/widget-b?order=o-1&row=1',
        },
      ],
    }).findAll('[data-testid="item-rows-row"]');

    expect(rows[0]!.find('a').attributes('href')).toBe(
      '/se/sv/p/widget-a?order=o-1&row=0',
    );
    expect(rows[1]!.find('a').attributes('href')).toBe(
      '/se/sv/p/widget-b?order=o-1&row=1',
    );
  });

  it('renders the totals including an emphasised grand total', () => {
    const text = mountSheet().text();
    expect(text).toContain('Subtotal (3 items)');
    expect(text).toContain('Total');
    expect(text).toContain('250 kr');
  });

  it('shows the sheet title', () => {
    expect(mountSheet().find('[data-testid="sheet-title"]').text()).toContain(
      'Order items',
    );
  });

  describe('a configured row', () => {
    const configured = [
      {
        ...items[0]!,
        configuration: {
          summary: [
            { label: 'Machine weight (7-20)', value: '12 t' },
            { label: 'Adapter', value: 'S45' },
          ],
        },
      },
      items[1]!,
    ];

    it("offers no way to edit an order row, which is the cart's alone", async () => {
      const wrapper = mountSheet({ items: configured });

      await wrapper
        .find('[data-testid="cart-item-configuration-toggle"]')
        .trigger('click');

      expect(wrapper.find('[data-testid="cart-item-edit"]').exists()).toBe(
        false,
      );
      expect(wrapper.text()).not.toContain('cart.edit_configuration');
    });

    it('shows its summary, collapsed, and none on a plain row', async () => {
      const wrapper = mountSheet({ items: configured });

      const [first, second] = wrapper.findAll('[data-testid="item-rows-row"]');
      const toggle = first!.find(
        '[data-testid="cart-item-configuration-toggle"]',
      );
      expect(toggle.attributes('aria-expanded')).toBe('false');
      expect(
        second!.find('[data-testid="cart-item-configuration-toggle"]').exists(),
      ).toBe(false);

      await toggle.trigger('click');

      expect(
        first!
          .findAll('[data-testid="cart-item-configuration-row"]')
          .map((row) => [row.find('dt').text(), row.find('dd').text()]),
      ).toEqual([
        ['Machine weight (7-20)', '12 t'],
        ['Adapter', 'S45'],
      ]);
    });

    it('marks it "Konfigurerad produkt" under its name', () => {
      const [first, second] = mountSheet({ items: configured }).findAll(
        '[data-testid="item-rows-row"]',
      );

      expect(first!.find('[data-testid="item-rows-configured"]').text()).toBe(
        'cart.configured_product',
      );
      const html = first!.html();
      expect(html.indexOf(items[0]!.name)).toBeLessThan(
        html.indexOf('item-rows-configured'),
      );
      expect(
        second!.find('[data-testid="item-rows-configured"]').exists(),
      ).toBe(false);
    });

    it('keeps the quantity and unit price line', () => {
      const wrapper = mountSheet({ items: configured });

      const first = wrapper.findAll('[data-testid="item-rows-row"]')[0]!;
      expect(first.find('[data-testid="item-rows-quantity"]').text()).toBe('2');
    });
  });
});
