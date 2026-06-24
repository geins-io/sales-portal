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
});
