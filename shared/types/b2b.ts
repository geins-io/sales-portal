// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------
export type OrgStatus = 'active' | 'suspended' | 'pending';

export interface Organization {
  id: string;
  name: string;
  organizationNumber: string;
  status: OrgStatus;
  referenceContact?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Address Book
// ---------------------------------------------------------------------------
export interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  postalCode: string;
  city: string;
  state?: string;
  country: string;
  phone?: string;
}

export interface OrgAddress {
  id: string;
  organizationId: string;
  label: string;
  isDefault: boolean;
  address: ShippingAddress;
}

// ---------------------------------------------------------------------------
// Buyer
// ---------------------------------------------------------------------------
export type BuyerStatus = 'active' | 'invited' | 'deactivated';

export interface Buyer {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: BuyerRole;
  status: BuyerStatus;
  lastLogin?: string;
  invitedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Roles and Permissions
// ---------------------------------------------------------------------------
export type BuyerRole = 'org_admin' | 'order_approver' | 'order_placer';

export type Permission =
  | 'orders:create'
  | 'orders:view_own'
  | 'orders:view_all'
  | 'orders:approve'
  | 'orders:reorder'
  | 'quotes:create'
  | 'quotes:view_own'
  | 'quotes:view_all'
  | 'quotes:accept'
  | 'quotes:reject'
  | 'org:view'
  | 'org:edit'
  | 'org:manage_addresses'
  | 'org:manage_buyers'
  | 'org:manage_roles'
  | 'lists:create'
  | 'lists:view_own'
  | 'lists:view_all';

export interface RoleDefinition {
  role: BuyerRole;
  label: string;
  description: string;
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Default role definitions
// ---------------------------------------------------------------------------
export const DEFAULT_ROLES: Record<BuyerRole, RoleDefinition> = {
  org_admin: {
    role: 'org_admin',
    label: 'Organization Admin',
    description: 'Full access to organization management and all orders',
    permissions: [
      'orders:create',
      'orders:view_own',
      'orders:view_all',
      'orders:approve',
      'orders:reorder',
      'quotes:create',
      'quotes:view_own',
      'quotes:view_all',
      'quotes:accept',
      'quotes:reject',
      'org:view',
      'org:edit',
      'org:manage_addresses',
      'org:manage_buyers',
      'org:manage_roles',
      'lists:create',
      'lists:view_own',
      'lists:view_all',
    ],
  },
  order_approver: {
    role: 'order_approver',
    label: 'Order Approver',
    description: 'Can approve orders and view all organization orders',
    permissions: [
      'orders:create',
      'orders:view_own',
      'orders:view_all',
      'orders:approve',
      'orders:reorder',
      'quotes:create',
      'quotes:view_own',
      'quotes:view_all',
      'quotes:accept',
      'quotes:reject',
      'org:view',
      'lists:create',
      'lists:view_own',
      'lists:view_all',
    ],
  },
  order_placer: {
    role: 'order_placer',
    label: 'Order Placer',
    description: 'Can create orders and view own orders',
    permissions: [
      'orders:create',
      'orders:view_own',
      'orders:reorder',
      'quotes:create',
      'quotes:view_own',
      'org:view',
      'lists:create',
      'lists:view_own',
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function getPermissionsForRole(role: BuyerRole): Permission[] {
  return DEFAULT_ROLES[role].permissions;
}

export function hasPermission(
  role: BuyerRole,
  permission: Permission,
): boolean {
  return DEFAULT_ROLES[role].permissions.includes(permission);
}
