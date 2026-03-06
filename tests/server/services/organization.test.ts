import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub Nitro auto-imports used by the organization stubs
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, message: string) => {
    const err = new Error(message);
    (err as Error & { statusCode: number }).statusCode =
      code === 'NOT_FOUND' ? 404 : 400;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
});

describe('organization service stubs', () => {
  // Fresh module state before every test
  let stubs: typeof import('../../../server/services/stubs/organization');

  beforeEach(async () => {
    vi.resetModules();
    stubs = await import('../../../server/services/stubs/organization');
  });

  // -----------------------------------------------------------------------
  // getOrganizationStub
  // -----------------------------------------------------------------------
  describe('getOrganizationStub', () => {
    it('returns the org when ID matches', () => {
      // Use getOrganizationByUserStub to discover the valid orgId
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const result = stubs.getOrganizationStub(org.id);

      expect(result).toMatchObject({
        id: org.id,
        name: 'Acme Corp',
        organizationNumber: '556677-8899',
        status: 'active',
      });
    });

    it('throws for an invalid ID', () => {
      expect(() => stubs.getOrganizationStub('invalid-id')).toThrow(
        'Organization invalid-id not found',
      );
    });
  });

  // -----------------------------------------------------------------------
  // updateOrganizationStub
  // -----------------------------------------------------------------------
  describe('updateOrganizationStub', () => {
    it('updates specified fields and preserves others', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const updated = stubs.updateOrganizationStub(org.id, {
        name: 'New Name',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.organizationNumber).toBe('556677-8899');
      expect(updated.email).toBe('info@acmecorp.se');
    });

    it('throws for an invalid org ID', () => {
      expect(() =>
        stubs.updateOrganizationStub('bad-id', { name: 'X' }),
      ).toThrow('Organization bad-id not found');
    });
  });

  // -----------------------------------------------------------------------
  // Address stubs
  // -----------------------------------------------------------------------
  describe('getAddressesStub', () => {
    it('returns addresses for the org', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const addrs = stubs.getAddressesStub(org.id);

      expect(addrs).toHaveLength(2);
      expect(addrs[0]).toMatchObject({
        label: 'Stockholm HQ',
        isDefault: true,
      });
      expect(addrs[1]).toMatchObject({
        label: 'Gothenburg Warehouse',
        isDefault: false,
      });
    });

    it('throws for invalid org ID', () => {
      expect(() => stubs.getAddressesStub('nope')).toThrow(
        'Organization nope not found',
      );
    });
  });

  describe('addAddressStub', () => {
    it('adds a new address and returns it', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const addr = stubs.addAddressStub(org.id, 'Malmo Office', {
        addressLine1: 'Storgatan 1',
        postalCode: '211 34',
        city: 'Malmo',
        country: 'SE',
      });

      expect(addr.label).toBe('Malmo Office');
      expect(addr.isDefault).toBe(false);
      expect(addr.address.city).toBe('Malmo');

      const all = stubs.getAddressesStub(org.id);
      expect(all).toHaveLength(3);
    });

    it('clears other defaults when adding a new default address', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      stubs.addAddressStub(
        org.id,
        'New Default',
        { addressLine1: 'X', postalCode: '1', city: 'Y', country: 'SE' },
        true,
      );

      const all = stubs.getAddressesStub(org.id);
      const defaults = all.filter((a) => a.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].label).toBe('New Default');
    });
  });

  describe('updateAddressStub', () => {
    it('updates the label of an existing address', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const addrs = stubs.getAddressesStub(org.id);
      const updated = stubs.updateAddressStub(org.id, addrs[0].id, {
        label: 'Renamed',
      });

      expect(updated.label).toBe('Renamed');
      expect(updated.address.city).toBe('Stockholm');
    });

    it('throws when address does not exist', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      expect(() =>
        stubs.updateAddressStub(org.id, 'no-such-addr', { label: 'X' }),
      ).toThrow('Address no-such-addr not found');
    });
  });

  describe('removeAddressStub', () => {
    it('removes an address', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const addrs = stubs.getAddressesStub(org.id);
      stubs.removeAddressStub(org.id, addrs[1].id);

      expect(stubs.getAddressesStub(org.id)).toHaveLength(1);
    });

    it('throws when address does not exist', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      expect(() => stubs.removeAddressStub(org.id, 'ghost')).toThrow(
        'Address ghost not found',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Buyer stubs
  // -----------------------------------------------------------------------
  describe('getBuyersStub', () => {
    it('returns all buyers for the org', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const buyerList = stubs.getBuyersStub(org.id);

      expect(buyerList).toHaveLength(3);
      expect(buyerList.map((b) => b.role)).toEqual(
        expect.arrayContaining(['org_admin', 'order_approver', 'order_placer']),
      );
    });

    it('throws for invalid org ID', () => {
      expect(() => stubs.getBuyersStub('wrong')).toThrow(
        'Organization wrong not found',
      );
    });
  });

  describe('inviteBuyerStub', () => {
    it('adds a new buyer with invited status', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const buyer = stubs.inviteBuyerStub(
        org.id,
        'new@acme.se',
        'Nils',
        'Karlsson',
        'order_placer',
      );

      expect(buyer.email).toBe('new@acme.se');
      expect(buyer.status).toBe('invited');
      expect(buyer.role).toBe('order_placer');
      expect(buyer.invitedAt).toBeDefined();

      expect(stubs.getBuyersStub(org.id)).toHaveLength(4);
    });
  });

  describe('updateBuyerRoleStub', () => {
    it('changes a buyer role', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const buyerList = stubs.getBuyersStub(org.id);
      const placer = buyerList.find((b) => b.role === 'order_placer')!;

      const updated = stubs.updateBuyerRoleStub(org.id, placer.id, 'org_admin');
      expect(updated.role).toBe('org_admin');
    });

    it('throws for unknown buyer', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      expect(() =>
        stubs.updateBuyerRoleStub(org.id, 'no-buyer', 'org_admin'),
      ).toThrow('Buyer no-buyer not found');
    });
  });

  describe('deactivateBuyerStub / reactivateBuyerStub', () => {
    it('deactivates and reactivates a buyer', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      const buyerList = stubs.getBuyersStub(org.id);
      const buyer = buyerList[0];

      const deactivated = stubs.deactivateBuyerStub(org.id, buyer.id);
      expect(deactivated.status).toBe('deactivated');

      const reactivated = stubs.reactivateBuyerStub(org.id, buyer.id);
      expect(reactivated.status).toBe('active');
    });
  });

  // -----------------------------------------------------------------------
  // User lookup helpers
  // -----------------------------------------------------------------------
  describe('getOrganizationByUserStub', () => {
    it('returns the org for a known user', () => {
      const org = stubs.getOrganizationByUserStub('user-admin-001');
      expect(org.name).toBe('Acme Corp');
    });

    it('throws for an unknown user', () => {
      expect(() => stubs.getOrganizationByUserStub('unknown')).toThrow(
        'No organization for user unknown',
      );
    });
  });

  describe('getBuyerByUserStub', () => {
    it('returns the buyer for a known user', () => {
      const buyer = stubs.getBuyerByUserStub('user-approver-002');
      expect(buyer.email).toBe('erik@acmecorp.se');
      expect(buyer.role).toBe('order_approver');
    });

    it('throws for an unknown user', () => {
      expect(() => stubs.getBuyerByUserStub('ghost')).toThrow(
        'No buyer profile for user ghost',
      );
    });
  });
});
