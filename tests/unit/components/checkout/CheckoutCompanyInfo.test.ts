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
  Building2: { template: '<svg />' },
};

function makeBillingAddress(overrides = {}) {
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
    addresses: [makeBillingAddress()],
    buyers: [],
    ...overrides,
  };
}

const CheckoutCompanyInfo =
  await import('../../../../app/components/checkout/CheckoutCompanyInfo.vue');

describe('CheckoutCompanyInfo', () => {
  it('renders company name', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: { company: makeCompany() },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="company-name"]').text()).toContain(
      'Acme AB',
    );
  });

  it('renders VAT number', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: { company: makeCompany() },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="company-vat"]').text()).toContain(
      'SE556000000101',
    );
  });

  it('renders billing address as comma-separated line (no name/company)', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: { company: makeCompany() },
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="company-billing-address"]');
    expect(addrBlock.text()).not.toContain('Jane Doe');
    expect(addrBlock.text()).not.toContain('Acme AB');
    expect(addrBlock.text()).toContain('Main Street 1');
    expect(addrBlock.text()).toContain('11122 Stockholm');
    expect(addrBlock.text()).toContain('SE');
  });

  it('renders buyerEmail prop in the buyer block, not billing address email', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: {
        company: makeCompany({
          buyers: [
            {
              id: 'buyer-1',
              firstName: 'Jane',
              lastName: 'Doe',
              phone: null,
              companyId: 'comp-1',
              active: true,
              restrictToDedicatedPriceLists: false,
            },
          ],
        }),
        buyerEmail: 'buyer@example.com',
      },
      global: { stubs },
    });
    const buyerBlock = wrapper.find('[data-testid="company-buyer"]');
    expect(buyerBlock.text()).toContain('Jane Doe');
    expect(buyerBlock.text()).toContain('buyer@example.com');
    expect(buyerBlock.text()).not.toContain('billing@acme.com');
  });

  it('shows buyer block when buyerEmail provided even without buyer name', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: {
        company: makeCompany({ buyers: [] }),
        buyerEmail: 'loggedin@example.com',
      },
      global: { stubs },
    });
    const buyerBlock = wrapper.find('[data-testid="company-buyer"]');
    expect(buyerBlock.exists()).toBe(true);
    expect(buyerBlock.text()).toContain('loggedin@example.com');
  });

  it('hides buyer block when no buyerEmail and no buyer name', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: { company: makeCompany({ buyers: [] }) },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="company-buyer"]').exists()).toBe(false);
  });

  it('emits changeCompanyDetails when button clicked', async () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: { company: makeCompany() },
      global: { stubs },
    });
    await wrapper
      .find('[data-testid="change-company-details"]')
      .trigger('click');
    expect(wrapper.emitted('changeCompanyDetails')).toHaveLength(1);
  });

  it('uses first address with addressType containing billing', () => {
    const deliveryAddr = makeBillingAddress({
      addressId: 'addr-2',
      addressType: 'delivery',
      addressLine1: 'Delivery Street 9',
    });
    const billingAddr = makeBillingAddress({
      addressId: 'addr-3',
      addressType: 'billing',
      addressLine1: 'Billing Street 3',
    });
    const company = makeCompany({ addresses: [deliveryAddr, billingAddr] });
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: { company },
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="company-billing-address"]');
    expect(addrBlock.text()).toContain('Billing Street 3');
    expect(addrBlock.text()).not.toContain('Delivery Street 9');
  });

  it('falls back to addresses[0] when no billing address type found', () => {
    const addr0 = makeBillingAddress({
      addressId: 'addr-fallback',
      addressType: 'other',
      firstName: 'Fallback',
      lastName: 'User',
      addressLine1: 'Fallback St 1',
    });
    const company = makeCompany({ addresses: [addr0] });
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: { company },
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="company-billing-address"]');
    expect(addrBlock.text()).toContain('Fallback St 1');
  });
});
