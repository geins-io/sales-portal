import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import OrgBuyerList from '../../../app/components/portal/org/OrgBuyerList.vue';
import type { Buyer } from '#shared/types/b2b';
import { createPinia, setActivePinia } from 'pinia';

// Mock useFetch for buyers list
const mockBuyers: Buyer[] = [
  {
    id: 'buyer-1',
    organizationId: 'org-1',
    userId: 'user-1',
    email: 'admin@acme.com',
    firstName: 'Alice',
    lastName: 'Admin',
    role: 'org_admin',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
  {
    id: 'buyer-2',
    organizationId: 'org-1',
    userId: 'user-2',
    email: 'bob@acme.com',
    firstName: 'Bob',
    lastName: 'Buyer',
    role: 'order_placer',
    status: 'active',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
  {
    id: 'buyer-3',
    organizationId: 'org-1',
    userId: 'user-3',
    email: 'carol@acme.com',
    firstName: 'Carol',
    lastName: 'Checker',
    role: 'order_approver',
    status: 'deactivated',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
];

const mockUseFetch = vi.fn(() => ({
  data: ref({ buyers: mockBuyers }),
  pending: ref(false),
  error: ref(null),
  status: ref('success'),
  refresh: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const stubs = {
  Icon: iconStub,
  NuxtIcon: iconStub,
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
    inheritAttrs: false,
  },
  Table: {
    template: '<table :data-testid="$attrs[\'data-testid\']"><slot /></table>',
    inheritAttrs: false,
  },
  TableHeader: {
    template: '<thead><slot /></thead>',
  },
  TableBody: {
    template: '<tbody><slot /></tbody>',
  },
  TableRow: {
    template: '<tr :data-testid="$attrs[\'data-testid\']"><slot /></tr>',
    inheritAttrs: false,
  },
  TableHead: {
    template: '<th><slot /></th>',
  },
  TableCell: {
    template: '<td><slot /></td>',
  },
  OrgBuyerInviteForm: {
    template: '<div data-testid="invite-form-stub"></div>',
    emits: ['invited', 'cancel'],
  },
  OrgBuyerRoleSelect: {
    template:
      '<select data-testid="role-select-stub"><option>{{ modelValue }}</option></select>',
    props: ['buyerId', 'modelValue'],
    emits: ['update:modelValue'],
  },
};

// Current buyer is the admin (buyer-1)
const adminBuyer: Buyer = mockBuyers[0]!;
const placerBuyer: Buyer = mockBuyers[1]!;

describe('OrgBuyerList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockUseFetch.mockReturnValue({
      data: ref({ buyers: mockBuyers }),
      pending: ref(false),
      error: ref(null),
      status: ref('success'),
      refresh: vi.fn(),
      execute: vi.fn(),
    });
  });

  it('renders buyer list container', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-buyer-list"]').exists()).toBe(true);
  });

  it('renders buyers table when data is loaded', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyers-table"]').exists()).toBe(true);
  });

  it('renders buyer rows', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyer-row-buyer-1"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="buyer-row-buyer-2"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="buyer-row-buyer-3"]').exists()).toBe(
      true,
    );
  });

  it('renders buyer names and emails', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Alice Admin');
    expect(wrapper.text()).toContain('admin@acme.com');
    expect(wrapper.text()).toContain('Bob Buyer');
    expect(wrapper.text()).toContain('bob@acme.com');
  });

  it('shows "(you)" label for the current buyer', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    const row = wrapper.find('[data-testid="buyer-row-buyer-1"]');
    expect(row.text()).toContain('portal.org.buyers.you');
  });

  it('shows invite button when current buyer can manage buyers', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyer-invite-btn"]').exists()).toBe(
      true,
    );
  });

  it('hides invite button when current buyer cannot manage buyers', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: placerBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyer-invite-btn"]').exists()).toBe(
      false,
    );
  });

  it('shows deactivate button for non-self active buyers when admin', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="buyer-deactivate-buyer-2"]').exists(),
    ).toBe(true);
  });

  it('shows reactivate button for deactivated buyers when admin', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="buyer-reactivate-buyer-3"]').exists(),
    ).toBe(true);
  });

  it('does not show deactivate button for self', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="buyer-deactivate-buyer-1"]').exists(),
    ).toBe(false);
  });

  it('shows status badges', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyer-status-buyer-1"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('[data-testid="buyer-status-buyer-1"]').text(),
    ).toContain('portal.org.buyers.status_active');
    expect(
      wrapper.find('[data-testid="buyer-status-buyer-3"]').text(),
    ).toContain('portal.org.buyers.status_deactivated');
  });

  it('shows loading state', () => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(true),
      error: ref(null),
      status: ref('pending'),
      refresh: vi.fn(),
      execute: vi.fn(),
    });
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyers-loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="buyers-table"]').exists()).toBe(false);
  });

  it('shows error state', () => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(new Error('Network error')),
      status: ref('error'),
      refresh: vi.fn(),
      execute: vi.fn(),
    });
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyers-error"]').exists()).toBe(true);
  });

  it('shows empty state when no buyers', () => {
    mockUseFetch.mockReturnValue({
      data: ref({ buyers: [] }),
      pending: ref(false),
      error: ref(null),
      status: ref('success'),
      refresh: vi.fn(),
      execute: vi.fn(),
    });
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyers-empty"]').exists()).toBe(true);
  });

  it('shows deactivate confirmation when deactivate is clicked', async () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    await wrapper
      .find('[data-testid="buyer-deactivate-buyer-2"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="buyer-confirm-deactivate-buyer-2"]').exists(),
    ).toBe(true);
  });

  it('hides actions column for non-admin buyers', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: placerBuyer },
      global: { stubs },
    });
    expect(wrapper.text()).not.toContain('portal.org.buyers.col_actions');
  });
});
