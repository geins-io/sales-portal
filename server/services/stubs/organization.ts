import type {
  Organization,
  OrgAddress,
  Buyer,
  BuyerRole,
  ShippingAddress,
} from '#shared/types/b2b';

// ---------------------------------------------------------------------------
// Mutable in-memory state
// ---------------------------------------------------------------------------
let org: Organization;
let addresses: OrgAddress[];
let buyers: Buyer[];

function createStubData() {
  const now = new Date().toISOString();
  const orgId = crypto.randomUUID();

  org = {
    id: orgId,
    name: 'Acme Corp',
    organizationNumber: '556677-8899',
    status: 'active',
    referenceContact: 'Anna Svensson',
    email: 'info@acmecorp.se',
    phone: '+46 8 123 456',
    createdAt: now,
    updatedAt: now,
  };

  addresses = [
    {
      id: crypto.randomUUID(),
      organizationId: orgId,
      label: 'Stockholm HQ',
      isDefault: true,
      address: {
        company: 'Acme Corp',
        addressLine1: 'Kungsgatan 10',
        postalCode: '111 43',
        city: 'Stockholm',
        country: 'SE',
        phone: '+46 8 123 456',
      },
    },
    {
      id: crypto.randomUUID(),
      organizationId: orgId,
      label: 'Gothenburg Warehouse',
      isDefault: false,
      address: {
        company: 'Acme Corp',
        addressLine1: 'Avenyn 22',
        postalCode: '411 36',
        city: 'Gothenburg',
        country: 'SE',
        phone: '+46 31 987 654',
      },
    },
  ];

  buyers = [
    {
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: 'user-admin-001',
      email: 'anna@acmecorp.se',
      firstName: 'Anna',
      lastName: 'Svensson',
      role: 'org_admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: 'user-approver-002',
      email: 'erik@acmecorp.se',
      firstName: 'Erik',
      lastName: 'Johansson',
      role: 'order_approver',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: 'user-placer-003',
      email: 'lisa@acmecorp.se',
      firstName: 'Lisa',
      lastName: 'Andersson',
      role: 'order_placer',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// Initialize on module load
createStubData();

// ---------------------------------------------------------------------------
// Organization stubs
// ---------------------------------------------------------------------------
export function getOrganizationStub(orgId: string): Organization {
  if (org.id !== orgId) {
    throw createAppError(
      ErrorCode.NOT_FOUND,
      `Organization ${orgId} not found`,
    );
  }
  return { ...org };
}

export function updateOrganizationStub(
  orgId: string,
  data: Partial<
    Pick<Organization, 'name' | 'referenceContact' | 'email' | 'phone'>
  >,
): Organization {
  if (org.id !== orgId) {
    throw createAppError(
      ErrorCode.NOT_FOUND,
      `Organization ${orgId} not found`,
    );
  }
  Object.assign(org, data, { updatedAt: new Date().toISOString() });
  return { ...org };
}

// ---------------------------------------------------------------------------
// Address stubs
// ---------------------------------------------------------------------------
export function getAddressesStub(orgId: string): OrgAddress[] {
  if (org.id !== orgId) {
    throw createAppError(
      ErrorCode.NOT_FOUND,
      `Organization ${orgId} not found`,
    );
  }
  return addresses
    .filter((a) => a.organizationId === orgId)
    .map((a) => ({ ...a, address: { ...a.address } }));
}

export function addAddressStub(
  orgId: string,
  label: string,
  address: ShippingAddress,
  isDefault?: boolean,
): OrgAddress {
  if (org.id !== orgId) {
    throw createAppError(
      ErrorCode.NOT_FOUND,
      `Organization ${orgId} not found`,
    );
  }
  if (isDefault) {
    addresses.forEach((a) => {
      if (a.organizationId === orgId) a.isDefault = false;
    });
  }
  const entry: OrgAddress = {
    id: crypto.randomUUID(),
    organizationId: orgId,
    label,
    isDefault: isDefault ?? false,
    address: { ...address },
  };
  addresses.push(entry);
  return { ...entry, address: { ...entry.address } };
}

export function updateAddressStub(
  orgId: string,
  addressId: string,
  data: Partial<Pick<OrgAddress, 'label' | 'isDefault' | 'address'>>,
): OrgAddress {
  const entry = addresses.find(
    (a) => a.id === addressId && a.organizationId === orgId,
  );
  if (!entry) {
    throw createAppError(ErrorCode.NOT_FOUND, `Address ${addressId} not found`);
  }
  if (data.isDefault) {
    addresses.forEach((a) => {
      if (a.organizationId === orgId) a.isDefault = false;
    });
  }
  if (data.label !== undefined) entry.label = data.label;
  if (data.isDefault !== undefined) entry.isDefault = data.isDefault;
  if (data.address) Object.assign(entry.address, data.address);
  return { ...entry, address: { ...entry.address } };
}

export function removeAddressStub(orgId: string, addressId: string): void {
  const idx = addresses.findIndex(
    (a) => a.id === addressId && a.organizationId === orgId,
  );
  if (idx === -1) {
    throw createAppError(ErrorCode.NOT_FOUND, `Address ${addressId} not found`);
  }
  addresses.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// Buyer stubs
// ---------------------------------------------------------------------------
export function getBuyersStub(orgId: string): Buyer[] {
  if (org.id !== orgId) {
    throw createAppError(
      ErrorCode.NOT_FOUND,
      `Organization ${orgId} not found`,
    );
  }
  return buyers
    .filter((b) => b.organizationId === orgId)
    .map((b) => ({ ...b }));
}

export function inviteBuyerStub(
  orgId: string,
  email: string,
  firstName: string,
  lastName: string,
  role: BuyerRole,
): Buyer {
  if (org.id !== orgId) {
    throw createAppError(
      ErrorCode.NOT_FOUND,
      `Organization ${orgId} not found`,
    );
  }
  const now = new Date().toISOString();
  const buyer: Buyer = {
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId: `user-${crypto.randomUUID().slice(0, 8)}`,
    email,
    firstName,
    lastName,
    role,
    status: 'invited',
    invitedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  buyers.push(buyer);
  return { ...buyer };
}

export function updateBuyerRoleStub(
  orgId: string,
  buyerId: string,
  role: BuyerRole,
): Buyer {
  const buyer = buyers.find(
    (b) => b.id === buyerId && b.organizationId === orgId,
  );
  if (!buyer) {
    throw createAppError(ErrorCode.NOT_FOUND, `Buyer ${buyerId} not found`);
  }
  buyer.role = role;
  buyer.updatedAt = new Date().toISOString();
  return { ...buyer };
}

export function deactivateBuyerStub(orgId: string, buyerId: string): Buyer {
  const buyer = buyers.find(
    (b) => b.id === buyerId && b.organizationId === orgId,
  );
  if (!buyer) {
    throw createAppError(ErrorCode.NOT_FOUND, `Buyer ${buyerId} not found`);
  }
  buyer.status = 'deactivated';
  buyer.updatedAt = new Date().toISOString();
  return { ...buyer };
}

export function reactivateBuyerStub(orgId: string, buyerId: string): Buyer {
  const buyer = buyers.find(
    (b) => b.id === buyerId && b.organizationId === orgId,
  );
  if (!buyer) {
    throw createAppError(ErrorCode.NOT_FOUND, `Buyer ${buyerId} not found`);
  }
  buyer.status = 'active';
  buyer.updatedAt = new Date().toISOString();
  return { ...buyer };
}

// ---------------------------------------------------------------------------
// Lookup helpers (for "my" endpoints that resolve by userId)
// ---------------------------------------------------------------------------
export function getOrganizationByUserStub(userId: string): Organization {
  const buyer = buyers.find((b) => b.userId === userId);
  if (!buyer) {
    throw createAppError(
      ErrorCode.NOT_FOUND,
      `No organization for user ${userId}`,
    );
  }
  return { ...org };
}

export function getBuyerByUserStub(userId: string): Buyer {
  const buyer = buyers.find((b) => b.userId === userId);
  if (!buyer) {
    throw createAppError(
      ErrorCode.NOT_FOUND,
      `No buyer profile for user ${userId}`,
    );
  }
  return { ...buyer };
}
