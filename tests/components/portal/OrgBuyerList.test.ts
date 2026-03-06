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
    lastLogin: '2026-01-15T10:30:00Z',
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
    lastLogin: '2026-02-20T14:00:00Z',
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
      '<button :data-testid="$attrs[\'data-testid\']" :class="$attrs.class" :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>',
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

  it('renders table with Id, Email, Role, Latest login columns', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    const headers = wrapper.findAll('th');
    const headerTexts = headers.map((h) => h.text());
    expect(headerTexts).toContain('portal.org.persons.col_id');
    expect(headerTexts).toContain('portal.org.buyers.col_email');
    expect(headerTexts).toContain('portal.org.buyers.col_role');
    expect(headerTexts).toContain('portal.org.persons.col_latest_login');
  });

  it('renders buyer rows with truncated ids and emails', () => {
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
    expect(wrapper.text()).toContain('admin@acme.com');
    expect(wrapper.text()).toContain('bob@acme.com');
  });

  it('renders last login date for buyers with lastLogin', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    // buyer-1 has lastLogin, should show a formatted date (not a dash)
    const loginCell = wrapper.find('[data-testid="buyer-last-login-buyer-1"]');
    expect(loginCell.exists()).toBe(true);
    expect(loginCell.text()).not.toBe('\u2014');
    // buyer-3 has no lastLogin, should show dash
    const noLoginCell = wrapper.find(
      '[data-testid="buyer-last-login-buyer-3"]',
    );
    expect(noLoginCell.exists()).toBe(true);
    expect(noLoginCell.text()).toBe('\u2014');
  });

  it('shows "(you)" label for the current buyer', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    const row = wrapper.find('[data-testid="buyer-row-buyer-1"]');
    expect(row.text()).toContain('portal.org.buyers.you');
  });

  it('shows invite button with "+ Add person" text when admin', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    const btn = wrapper.find('[data-testid="buyer-invite-btn"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('portal.org.persons.add');
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

  it('shows edit and delete icon buttons for non-self buyers when admin', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyer-edit-buyer-2"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="buyer-delete-buyer-2"]').exists()).toBe(
      true,
    );
  });

  it('does not show action buttons for self', () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="buyer-edit-buyer-1"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="buyer-delete-buyer-1"]').exists()).toBe(
      false,
    );
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

  it('shows deactivate confirmation when delete icon is clicked', async () => {
    const wrapper = mountComponent(OrgBuyerList, {
      props: { currentBuyer: adminBuyer },
      global: { stubs },
    });
    await wrapper.find('[data-testid="buyer-delete-buyer-2"]').trigger('click');
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
