import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import SavedListsTable from '../../../app/components/portal/SavedListsTable.vue';

// Mirror of the SDK `ProductList` shape — id, name, items as product
// alias strings, createdAt, updatedAt. SavedListsTable consumes this
// directly now (was previously fed the server-stub `SavedList` shape
// with rich item data).
const mockLists = [
  {
    id: 'list-1',
    name: 'Office Supplies',
    items: ['pens', 'paper'],
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-15T14:30:00Z',
  },
  {
    id: 'list-2',
    name: 'Empty List',
    items: [],
    createdAt: '2026-04-10T09:00:00Z',
    updatedAt: '2026-04-10T09:00:00Z',
  },
];

describe('SavedListsTable', () => {
  it('renders one row per list', () => {
    const wrapper = mountComponent(SavedListsTable, {
      props: { lists: mockLists },
    });
    expect(wrapper.findAll('[data-testid="saved-list-row"]')).toHaveLength(
      mockLists.length * 2, // mobile cards + desktop rows
    );
  });

  it('shows the list name', () => {
    const wrapper = mountComponent(SavedListsTable, {
      props: { lists: mockLists },
    });
    expect(wrapper.text()).toContain('Office Supplies');
    expect(wrapper.text()).toContain('Empty List');
  });

  it('shows the item count', () => {
    const wrapper = mountComponent(SavedListsTable, {
      props: { lists: mockLists },
    });
    // 2 items in first list, 0 in second
    expect(wrapper.text()).toContain('2');
    expect(wrapper.text()).toContain('0');
  });

  it('renders nothing when lists prop is empty', () => {
    const wrapper = mountComponent(SavedListsTable, {
      props: { lists: [] },
    });
    expect(wrapper.find('[data-testid="saved-list-row"]').exists()).toBe(false);
  });
});
