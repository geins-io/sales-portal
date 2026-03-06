import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import OrgRoleList from '../../../app/components/portal/org/OrgRoleList.vue';
import type { Buyer } from '#shared/types/b2b';

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const stubs = {
  Icon: iconStub,
  NuxtIcon: iconStub,
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>',
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
};

const mockBuyers: Buyer[] = [
  {
    id: 'b1',
    organizationId: 'org-1',
    userId: 'u1',
    email: 'admin@acme.com',
    firstName: 'Alice',
    lastName: 'Admin',
    role: 'org_admin',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'b2',
    organizationId: 'org-1',
    userId: 'u2',
    email: 'bob@acme.com',
    firstName: 'Bob',
    lastName: 'Buyer',
    role: 'order_placer',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'b3',
    organizationId: 'org-1',
    userId: 'u3',
    email: 'carol@acme.com',
    firstName: 'Carol',
    lastName: 'Checker',
    role: 'order_placer',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

describe('OrgRoleList', () => {
  it('renders the role list container', () => {
    const wrapper = mountComponent(OrgRoleList, {
      props: { buyers: mockBuyers, canManageRoles: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-role-list"]').exists()).toBe(true);
  });

  it('renders roles table with correct columns', () => {
    const wrapper = mountComponent(OrgRoleList, {
      props: { buyers: mockBuyers, canManageRoles: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="roles-table"]').exists()).toBe(true);
    const headers = wrapper.findAll('th');
    const headerTexts = headers.map((h) => h.text());
    expect(headerTexts).toContain('portal.org.roles.col_role');
    expect(headerTexts).toContain('portal.org.roles.col_description');
    expect(headerTexts).toContain('portal.org.roles.col_assigned');
    expect(headerTexts).toContain('portal.org.buyers.col_actions');
  });

  it('renders rows for all 3 default roles', () => {
    const wrapper = mountComponent(OrgRoleList, {
      props: { buyers: mockBuyers, canManageRoles: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="role-row-org_admin"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('[data-testid="role-row-order_approver"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="role-row-order_placer"]').exists()).toBe(
      true,
    );
  });

  it('renders role labels and descriptions', () => {
    const wrapper = mountComponent(OrgRoleList, {
      props: { buyers: mockBuyers, canManageRoles: true },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Organization Admin');
    expect(wrapper.text()).toContain('Order Approver');
    expect(wrapper.text()).toContain('Order Placer');
    expect(wrapper.text()).toContain(
      'Full access to organization management and all orders',
    );
  });

  it('computes correct assigned-person counts', () => {
    const wrapper = mountComponent(OrgRoleList, {
      props: { buyers: mockBuyers, canManageRoles: true },
      global: { stubs },
    });
    // org_admin: 1 (Alice), order_placer: 2 (Bob + Carol), order_approver: 0
    const adminRow = wrapper.find('[data-testid="role-row-org_admin"]');
    expect(adminRow.text()).toContain('1');
    const placerRow = wrapper.find('[data-testid="role-row-order_placer"]');
    expect(placerRow.text()).toContain('2');
    const approverRow = wrapper.find('[data-testid="role-row-order_approver"]');
    expect(approverRow.text()).toContain('0');
  });

  it('shows action buttons when canManageRoles is true', () => {
    const wrapper = mountComponent(OrgRoleList, {
      props: { buyers: mockBuyers, canManageRoles: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="role-edit-org_admin"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="role-delete-org_admin"]').exists()).toBe(
      true,
    );
  });

  it('hides action buttons when canManageRoles is false', () => {
    const wrapper = mountComponent(OrgRoleList, {
      props: { buyers: mockBuyers, canManageRoles: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="role-edit-org_admin"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="role-delete-org_admin"]').exists()).toBe(
      false,
    );
    // Actions column header should also be hidden
    expect(wrapper.text()).not.toContain('portal.org.buyers.col_actions');
  });

  it('renders add and save buttons (disabled)', () => {
    const wrapper = mountComponent(OrgRoleList, {
      props: { buyers: mockBuyers, canManageRoles: true },
      global: { stubs },
    });
    const addBtn = wrapper.find('[data-testid="role-add-btn"]');
    const saveBtn = wrapper.find('[data-testid="role-save-btn"]');
    expect(addBtn.exists()).toBe(true);
    expect(saveBtn.exists()).toBe(true);
    expect(addBtn.attributes('disabled')).toBeDefined();
    expect(saveBtn.attributes('disabled')).toBeDefined();
  });
});
