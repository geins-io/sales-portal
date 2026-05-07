import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Company, CompanyAddress } from '../../../shared/types/company';

// Mock $fetch at module level
let mockFetchImpl: ReturnType<typeof vi.fn> = vi.fn();

vi.mock('#app/composables/fetch', () => ({
  $fetch: (...args: unknown[]) => mockFetchImpl(...args),
}));

vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));

// Mock useCookie for cart store dependency
const mockCartIdRef = { value: 'cart-abc' };
vi.mock('#app/composables/cookie', () => ({
  useCookie: vi.fn(() => mockCartIdRef),
}));

// Mock logger
vi.mock('~/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import stores after mocks
const { useCheckoutStore } = await import('../../../app/stores/checkout');
const { useAuthStore } = await import('../../../app/stores/auth');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAddress(overrides: Partial<CompanyAddress> = {}): CompanyAddress {
  return {
    addressId: 'addr-1',
    companyId: 'comp-1',
    email: 'billing@acme.com',
    phone: '+46-70-111-2222',
    company: 'Acme AB',
    firstName: 'Jane',
    lastName: 'Doe',
    careOf: 'Care of Someone',
    addressLine1: 'Main Street 1',
    addressLine2: 'Floor 2',
    addressLine3: null,
    zip: '11122',
    city: 'Stockholm',
    region: null,
    country: 'SE',
    addressType: 'billing',
    addressReferenceId: null,
    ...overrides,
  };
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-001',
    name: 'Acme AB',
    vatNumber: 'SE556000000101',
    exVat: true,
    limitedProductAccess: false,
    addresses: [makeAddress()],
    buyers: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCheckoutStore — prefillFromCompany', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockFetchImpl = vi.fn();
    vi.stubGlobal('$fetch', (...args: unknown[]) => mockFetchImpl(...args));
  });

  it('sets email from billing address email', () => {
    const store = useCheckoutStore();
    const company = makeCompany();

    store.prefillFromCompany(company);

    expect(store.email).toBe('billing@acme.com');
  });

  it('falls back to authStore user username when billing address has no email', () => {
    const authStore = useAuthStore();
    authStore.user = {
      username: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      customerType: 'PRIVATE',
      memberType: 'Member',
      memberId: '1',
    } as never;

    const store = useCheckoutStore();
    const company = makeCompany({
      addresses: [makeAddress({ email: null })],
    });

    store.prefillFromCompany(company);

    expect(store.email).toBe('user@example.com');
  });

  it('maps billingAddress fields from CompanyAddress correctly', () => {
    const store = useCheckoutStore();
    const billingAddr = makeAddress({
      firstName: 'Jane',
      lastName: 'Doe',
      addressLine1: 'Main Street 1',
      addressLine2: 'Floor 2',
      addressLine3: null,
      careOf: 'Care of Someone',
      city: 'Stockholm',
      zip: '11122',
      country: 'SE',
      company: 'Acme AB',
      phone: '+46-70-111-2222',
    });
    const company = makeCompany({ addresses: [billingAddr] });

    store.prefillFromCompany(company);

    expect(store.billingAddress.firstName).toBe('Jane');
    expect(store.billingAddress.lastName).toBe('Doe');
    expect(store.billingAddress.addressLine1).toBe('Main Street 1');
    expect(store.billingAddress.addressLine2).toBe('Floor 2');
    expect(store.billingAddress.addressLine3).toBe('');
    expect(store.billingAddress.careOf).toBe('Care of Someone');
    expect(store.billingAddress.city).toBe('Stockholm');
    expect(store.billingAddress.zip).toBe('11122');
    expect(store.billingAddress.country).toBe('SE');
    expect(store.billingAddress.company).toBe('Acme AB');
    expect(store.billingAddress.phone).toBe('+46-70-111-2222');
    expect(store.billingAddress.mobile).toBe('');
  });

  it('maps shippingAddress from delivery-type address when available', () => {
    const billingAddr = makeAddress({
      addressId: 'addr-billing',
      addressType: 'billing',
      firstName: 'Billing',
      lastName: 'User',
      addressLine1: 'Billing St 1',
    });
    const deliveryAddr = makeAddress({
      addressId: 'addr-delivery',
      addressType: 'delivery',
      firstName: 'Delivery',
      lastName: 'Person',
      addressLine1: 'Warehouse Rd 5',
    });
    const store = useCheckoutStore();
    const company = makeCompany({ addresses: [billingAddr, deliveryAddr] });

    store.prefillFromCompany(company);

    expect(store.shippingAddress.firstName).toBe('Delivery');
    expect(store.shippingAddress.addressLine1).toBe('Warehouse Rd 5');
  });

  it('falls back shippingAddress to billing address when no delivery type', () => {
    const billingAddr = makeAddress({
      addressType: 'billing',
      firstName: 'Billing',
      lastName: 'Only',
      addressLine1: 'Billing Only St',
    });
    const store = useCheckoutStore();
    const company = makeCompany({ addresses: [billingAddr] });

    store.prefillFromCompany(company);

    expect(store.shippingAddress.firstName).toBe('Billing');
    expect(store.shippingAddress.addressLine1).toBe('Billing Only St');
  });
});
