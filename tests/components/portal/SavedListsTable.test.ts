import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import SavedListsTable from '../../../app/components/portal/SavedListsTable.vue';

const mockLists = [
  {
    id: 'list-1',
    userId: 'user-1',
    name: 'Office Supplies',
    description: 'Monthly office order',
    items: [
      {
        id: 'item-1',
        productId: 100,
        sku: 'SKU-100',
        name: 'Pens',
        articleNumber: 'ART-100',
        quantity: 10,
        unitPrice: 25,
        unitPriceFormatted: '25 SEK',
      },
      {
        id: 'item-2',
        productId: 101,
        sku: 'SKU-101',
        name: 'Paper',
        articleNumber: 'ART-101',
        quantity: 5,
        unitPrice: 50,
        unitPriceFormatted: '50 SEK',
      },
    ],
    createdBy: 'Adam Johnsson',
    createdAt: '2025-12-22T17:22:00Z',
    updatedAt: '2025-12-23T10:00:00Z',
  },
  {
    id: 'list-2',
    userId: 'user-1',
    name: 'Warehouse Stock',
    description: '',
    items: [
      {
        id: 'item-3',
        productId: 200,
        sku: 'SKU-200',
        name: 'Boxes',
        articleNumber: 'ART-200',
        quantity: 100,
        unitPrice: 10,
        unitPriceFormatted: '10 SEK',
      },
    ],
    createdBy: 'Jessica Andersson',
    createdAt: '2025-12-20T08:00:00Z',
    updatedAt: '2025-12-21T14:30:00Z',
  },
];

const defaultStubs = {
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
};

describe('SavedListsTable', () => {
  it('renders table headers', () => {
    const wrapper = shallowMountComponent(SavedListsTable, {
      props: { lists: mockLists },
      global: { stubs: defaultStubs },
    });
    expect(wrapper.text()).toContain('portal.saved_lists.columns.name');
    expect(wrapper.text()).toContain('portal.saved_lists.columns.created_by');
    expect(wrapper.text()).toContain('portal.saved_lists.columns.modified');
    expect(wrapper.text()).toContain('portal.saved_lists.columns.products');
  });

  it('renders rows for each list', () => {
    const wrapper = shallowMountComponent(SavedListsTable, {
      props: { lists: mockLists },
      global: { stubs: defaultStubs },
    });
    const rows = wrapper
      .find('table')
      .findAll('[data-testid="saved-list-row"]');
    expect(rows.length).toBe(2);
  });

  it('renders list name in each row', () => {
    const wrapper = shallowMountComponent(SavedListsTable, {
      props: { lists: mockLists },
      global: { stubs: defaultStubs },
    });
    expect(wrapper.text()).toContain('Office Supplies');
    expect(wrapper.text()).toContain('Warehouse Stock');
  });

  it('renders created by in each row', () => {
    const wrapper = shallowMountComponent(SavedListsTable, {
      props: { lists: mockLists },
      global: { stubs: defaultStubs },
    });
    expect(wrapper.text()).toContain('Adam Johnsson');
    expect(wrapper.text()).toContain('Jessica Andersson');
  });

  it('renders product count for each list', () => {
    const wrapper = shallowMountComponent(SavedListsTable, {
      props: { lists: mockLists },
      global: { stubs: defaultStubs },
    });
    expect(wrapper.text()).toContain('2');
    expect(wrapper.text()).toContain('1');
  });

  it('renders edit icon linking to correct path', () => {
    const wrapper = shallowMountComponent(SavedListsTable, {
      props: { lists: mockLists },
      global: { stubs: defaultStubs },
    });
    const editLinks = wrapper.findAll('[data-testid="saved-list-edit"]');
    expect(editLinks.length).toBe(2);
    expect(editLinks[0].attributes('href')).toContain(
      '/portal/saved-lists/list-1',
    );
  });

  it('renders view icon linking to correct path', () => {
    const wrapper = shallowMountComponent(SavedListsTable, {
      props: { lists: mockLists },
      global: { stubs: defaultStubs },
    });
    const viewLinks = wrapper.findAll('[data-testid="saved-list-view"]');
    expect(viewLinks.length).toBe(2);
    expect(viewLinks[0].attributes('href')).toContain(
      '/portal/saved-lists/list-1',
    );
  });

  it('has correct data-testid on table root', () => {
    const wrapper = shallowMountComponent(SavedListsTable, {
      props: { lists: mockLists },
      global: { stubs: defaultStubs },
    });
    expect(wrapper.find('[data-testid="saved-lists-table"]').exists()).toBe(
      true,
    );
  });
});
