import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ROLES,
  getPermissionsForRole,
  hasPermission,
} from '../../shared/types/b2b';
import type { BuyerRole } from '../../shared/types/b2b';

describe('DEFAULT_ROLES', () => {
  it('defines exactly 3 roles', () => {
    expect(Object.keys(DEFAULT_ROLES)).toHaveLength(3);
  });

  it('defines org_admin, order_approver, and order_placer', () => {
    expect(Object.keys(DEFAULT_ROLES)).toEqual(
      expect.arrayContaining(['org_admin', 'order_approver', 'order_placer']),
    );
  });

  it.each(Object.keys(DEFAULT_ROLES) as BuyerRole[])(
    '%s has label and description',
    (role) => {
      const def = DEFAULT_ROLES[role];
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(typeof def.label).toBe('string');
      expect(typeof def.description).toBe('string');
    },
  );

  it.each(Object.keys(DEFAULT_ROLES) as BuyerRole[])(
    '%s includes org:view permission',
    (role) => {
      expect(DEFAULT_ROLES[role].permissions).toContain('org:view');
    },
  );

  describe('org_admin', () => {
    const perms = DEFAULT_ROLES.org_admin.permissions;

    it('has all management permissions', () => {
      expect(perms).toContain('org:manage_buyers');
      expect(perms).toContain('org:manage_roles');
      expect(perms).toContain('org:edit');
      expect(perms).toContain('orders:approve');
      expect(perms).toContain('orders:create');
    });

    it('has the most permissions of any role', () => {
      expect(perms.length).toBeGreaterThan(
        DEFAULT_ROLES.order_approver.permissions.length,
      );
      expect(perms.length).toBeGreaterThan(
        DEFAULT_ROLES.order_placer.permissions.length,
      );
    });
  });

  describe('order_approver', () => {
    const perms = DEFAULT_ROLES.order_approver.permissions;

    it('can approve orders', () => {
      expect(perms).toContain('orders:approve');
    });

    it('cannot manage buyers or roles or edit org', () => {
      expect(perms).not.toContain('org:manage_buyers');
      expect(perms).not.toContain('org:manage_roles');
      expect(perms).not.toContain('org:edit');
    });
  });

  describe('order_placer', () => {
    const perms = DEFAULT_ROLES.order_placer.permissions;

    it('can create orders', () => {
      expect(perms).toContain('orders:create');
    });

    it('has minimal permissions — no approve, no manage, no edit', () => {
      expect(perms).not.toContain('orders:approve');
      expect(perms).not.toContain('org:manage_buyers');
      expect(perms).not.toContain('org:manage_roles');
      expect(perms).not.toContain('org:edit');
      expect(perms).not.toContain('orders:view_all');
    });
  });
});

describe('getPermissionsForRole', () => {
  it('returns the permission array for org_admin', () => {
    expect(getPermissionsForRole('org_admin')).toEqual(
      DEFAULT_ROLES.org_admin.permissions,
    );
  });

  it('returns the permission array for order_placer', () => {
    expect(getPermissionsForRole('order_placer')).toEqual(
      DEFAULT_ROLES.order_placer.permissions,
    );
  });
});

describe('hasPermission', () => {
  it('returns true when role has the permission', () => {
    expect(hasPermission('org_admin', 'org:manage_buyers')).toBe(true);
  });

  it('returns false when role lacks the permission', () => {
    expect(hasPermission('order_placer', 'orders:approve')).toBe(false);
  });

  it('returns true for org:view on every role', () => {
    const roles: BuyerRole[] = ['org_admin', 'order_approver', 'order_placer'];
    for (const role of roles) {
      expect(hasPermission(role, 'org:view')).toBe(true);
    }
  });

  it('returns false for order_approver managing buyers', () => {
    expect(hasPermission('order_approver', 'org:manage_buyers')).toBe(false);
  });
});
