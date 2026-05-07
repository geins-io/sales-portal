// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { Company } from '../../../../app/../shared/types/company';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('en'),
  }),
}));

vi.stubGlobal('useI18n', () => ({
  t: (key: string) => key,
  locale: ref('en'),
}));

const stubs = {
  Card: { template: '<div><slot /></div>' },
  CardHeader: { template: '<div><slot /></div>' },
  CardTitle: { template: '<h2><slot /></h2>' },
  CardContent: { template: '<div><slot /></div>' },
  MapPin: { template: '<svg />' },
};

function makeAddress(overrides = {}) {
  return {
    addressId: 'addr-1',
    companyId: 'comp-1',
    email: 'billing@acme.com',
    phone: '+46-70-000-0001',
    company: 'Acme AB',
    firstName: 'Jane',
    lastName: 'Doe',
    careOf: null,
    addressLine1: 'Main Street 1',
    addressLine2: null,
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

const CheckoutDeliveryInfo =
  await import('../../../../app/components/checkout/CheckoutDeliveryInfo.vue');

describe('CheckoutDeliveryInfo', () => {
  it('renders delivery address fields', () => {
    const deliveryAddr = makeAddress({
      addressId: 'addr-delivery',
      addressType: 'delivery',
      firstName: 'Delivery',
      lastName: 'Contact',
      addressLine1: 'Warehouse Road 5',
      zip: '22233',
      city: 'Gothenburg',
      country: 'SE',
      phone: '+46-70-000-0002',
    });
    const company = makeCompany({ addresses: [deliveryAddr] });
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: { company },
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="delivery-address"]');
    expect(addrBlock.text()).toContain('Delivery Contact');
    expect(addrBlock.text()).toContain('Warehouse Road 5');
    expect(addrBlock.text()).toContain('22233 Gothenburg');
    expect(addrBlock.text()).toContain('SE');
    expect(addrBlock.text()).toContain('+46-70-000-0002');
  });

  it('uses first delivery/shipping type address when available', () => {
    const billingAddr = makeAddress({
      addressId: 'addr-billing',
      addressType: 'billing',
      firstName: 'Billing',
      lastName: 'User',
    });
    const shippingAddr = makeAddress({
      addressId: 'addr-shipping',
      addressType: 'shipping',
      firstName: 'Shipping',
      lastName: 'User',
    });
    const company = makeCompany({ addresses: [billingAddr, shippingAddr] });
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: { company },
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="delivery-address"]');
    expect(addrBlock.text()).toContain('Shipping User');
    expect(addrBlock.text()).not.toContain('Billing User');
  });

  it('falls back to billing address when no delivery/shipping address found', () => {
    const billingAddr = makeAddress({
      addressId: 'addr-billing',
      addressType: 'billing',
      firstName: 'Billing',
      lastName: 'Fallback',
    });
    const company = makeCompany({ addresses: [billingAddr] });
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: { company },
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="delivery-address"]');
    expect(addrBlock.text()).toContain('Billing Fallback');
  });
});
