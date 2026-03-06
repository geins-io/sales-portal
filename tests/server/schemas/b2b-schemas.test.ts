import { describe, it, expect } from 'vitest';
import {
  UpdateOrganizationSchema,
  AddAddressSchema,
  UpdateAddressSchema,
  InviteBuyerSchema,
  UpdateBuyerRoleSchema,
} from '../../../server/schemas/api-input';

// ---------------------------------------------------------------------------
// UpdateOrganizationSchema
// ---------------------------------------------------------------------------
describe('UpdateOrganizationSchema', () => {
  it('accepts valid partial update', () => {
    const result = UpdateOrganizationSchema.safeParse({
      name: 'New Corp',
      email: 'info@new.se',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no changes)', () => {
    const result = UpdateOrganizationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = UpdateOrganizationSchema.safeParse({ email: 'not-email' });
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding max length', () => {
    const result = UpdateOrganizationSchema.safeParse({
      name: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AddAddressSchema
// ---------------------------------------------------------------------------
describe('AddAddressSchema', () => {
  const validAddress = {
    label: 'Office',
    address: {
      addressLine1: 'Street 1',
      postalCode: '12345',
      city: 'Stockholm',
      country: 'SE',
    },
  };

  it('accepts valid address', () => {
    const result = AddAddressSchema.safeParse(validAddress);
    expect(result.success).toBe(true);
  });

  it('accepts address with all optional fields', () => {
    const result = AddAddressSchema.safeParse({
      label: 'Full',
      isDefault: true,
      address: {
        firstName: 'A',
        lastName: 'B',
        company: 'C',
        addressLine1: 'Street',
        addressLine2: 'Floor 2',
        addressLine3: 'Box 3',
        postalCode: '111',
        city: 'City',
        state: 'State',
        country: 'SE',
        phone: '+46123',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required label', () => {
    const result = AddAddressSchema.safeParse({
      address: validAddress.address,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required address fields', () => {
    const result = AddAddressSchema.safeParse({
      label: 'Test',
      address: { addressLine1: 'Street' },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateAddressSchema
// ---------------------------------------------------------------------------
describe('UpdateAddressSchema', () => {
  it('accepts partial update with label only', () => {
    const result = UpdateAddressSchema.safeParse({ label: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('accepts partial address update', () => {
    const result = UpdateAddressSchema.safeParse({
      address: { city: 'Gothenburg' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = UpdateAddressSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects non-string address field', () => {
    const result = UpdateAddressSchema.safeParse({
      address: { city: 123 },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// InviteBuyerSchema
// ---------------------------------------------------------------------------
describe('InviteBuyerSchema', () => {
  const validInvite = {
    email: 'new@acme.se',
    firstName: 'Nils',
    lastName: 'Svensson',
    role: 'order_placer',
  };

  it('accepts valid invite', () => {
    const result = InviteBuyerSchema.safeParse(validInvite);
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const { email: _, ...noEmail } = validInvite;
    const result = InviteBuyerSchema.safeParse(noEmail);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = InviteBuyerSchema.safeParse({
      ...validInvite,
      email: 'bad',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = InviteBuyerSchema.safeParse({
      ...validInvite,
      firstName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role string', () => {
    const result = InviteBuyerSchema.safeParse({
      ...validInvite,
      role: 'super_admin',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateBuyerRoleSchema
// ---------------------------------------------------------------------------
describe('UpdateBuyerRoleSchema', () => {
  it('accepts org_admin', () => {
    expect(UpdateBuyerRoleSchema.safeParse({ role: 'org_admin' }).success).toBe(
      true,
    );
  });

  it('accepts order_approver', () => {
    expect(
      UpdateBuyerRoleSchema.safeParse({ role: 'order_approver' }).success,
    ).toBe(true);
  });

  it('accepts order_placer', () => {
    expect(
      UpdateBuyerRoleSchema.safeParse({ role: 'order_placer' }).success,
    ).toBe(true);
  });

  it('rejects invalid role', () => {
    expect(UpdateBuyerRoleSchema.safeParse({ role: 'viewer' }).success).toBe(
      false,
    );
  });

  it('rejects missing role', () => {
    expect(UpdateBuyerRoleSchema.safeParse({}).success).toBe(false);
  });

  it('rejects numeric role', () => {
    expect(UpdateBuyerRoleSchema.safeParse({ role: 1 }).success).toBe(false);
  });
});
