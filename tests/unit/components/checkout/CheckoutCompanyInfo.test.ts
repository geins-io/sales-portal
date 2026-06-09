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
  Input: {
    template:
      '<input :value="modelValue" :disabled="disabled" data-testid="input-stub" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
    props: ['modelValue', 'disabled', 'type', 'maxlength', 'placeholder'],
    emits: ['update:modelValue', 'blur'],
  },
  Label: { template: '<label><slot /></label>' },
  CheckoutCardHeader: {
    template: '<div data-testid="checkout-card-header" />',
    props: ['icon', 'title'],
  },
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

function makeProps(
  overrides: Partial<
    InstanceType<typeof CheckoutCompanyInfo.default>['$props']
  > = {},
) {
  return {
    company: makeCompany(),
    customerOrderNumber: '',
    disabled: false,
    ...overrides,
  };
}

describe('CheckoutCompanyInfo', () => {
  it('renders company name', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps(),
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="company-name"]').text()).toContain(
      'Acme AB',
    );
  });

  it('renders VAT number', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps(),
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="company-vat"]').text()).toContain(
      'SE556000000101',
    );
  });

  it('renders billing address as comma-separated line (no name/company)', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps(),
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="company-billing-address"]');
    expect(addrBlock.text()).not.toContain('Jane Doe');
    expect(addrBlock.text()).not.toContain('Acme AB');
    expect(addrBlock.text()).toContain('Main Street 1');
    expect(addrBlock.text()).toContain('11122 Stockholm');
    expect(addrBlock.text()).toContain('SE');
  });

  function makeBuyer(overrides = {}) {
    return {
      id: 'buyer@example.com',
      internalId: null,
      firstName: 'Jane',
      lastName: 'Doe',
      phone: null,
      companyId: 'comp-1',
      active: true,
      restrictToDedicatedPriceLists: false,
      ...overrides,
    };
  }

  it('renders buyerEmail prop in the buyer block, not billing address email', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps({
        company: makeCompany({ buyers: [makeBuyer()] }),
        buyerEmail: 'buyer@example.com',
      }),
      global: { stubs },
    });
    const buyerBlock = wrapper.find('[data-testid="company-buyer"]');
    expect(buyerBlock.text()).toContain('Jane Doe');
    expect(buyerBlock.text()).toContain('buyer@example.com');
    expect(buyerBlock.text()).not.toContain('billing@acme.com');
  });

  it('shows the buyer matching buyerEmail, not the first buyer in the list', () => {
    // Geins stores each buyer's email as `id`. The company lists its primary
    // contact first; the logged-in user is a different, later buyer. The buyer
    // block must show the logged-in user's name, not buyers[0]'s.
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps({
        company: makeCompany({
          buyers: [
            makeBuyer({
              id: 'primary@example.com',
              firstName: 'Anna',
              lastName: 'Andersson',
            }),
            makeBuyer({
              id: 'logged-in@example.com',
              firstName: 'Bertil',
              lastName: 'Bok',
            }),
          ],
        }),
        buyerEmail: 'logged-in@example.com',
      }),
      global: { stubs },
    });
    const buyerBlock = wrapper.find('[data-testid="company-buyer"]');
    expect(buyerBlock.text()).toContain('Bertil Bok');
    expect(buyerBlock.text()).not.toContain('Anna Andersson');
    expect(buyerBlock.text()).toContain('logged-in@example.com');
  });

  it('matches the buyer email case-insensitively', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps({
        company: makeCompany({
          buyers: [makeBuyer({ id: 'Buyer@Example.com' })],
        }),
        buyerEmail: 'buyer@example.com',
      }),
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="company-buyer"]').text()).toContain(
      'Jane Doe',
    );
  });

  it('shows no buyer name when no buyer matches buyerEmail (email only)', () => {
    // A wrong name is worse than no name: when the logged-in email is not in
    // the buyers list we render the email alone rather than buyers[0].
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps({
        company: makeCompany({
          buyers: [
            makeBuyer({
              id: 'primary@example.com',
              firstName: 'Anna',
              lastName: 'Andersson',
            }),
          ],
        }),
        buyerEmail: 'someone-else@example.com',
      }),
      global: { stubs },
    });
    const buyerBlock = wrapper.find('[data-testid="company-buyer"]');
    expect(buyerBlock.text()).not.toContain('Anna Andersson');
    expect(buyerBlock.text()).toContain('someone-else@example.com');
  });

  it('shows buyer block when buyerEmail provided even without buyer name', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps({
        company: makeCompany({ buyers: [] }),
        buyerEmail: 'loggedin@example.com',
      }),
      global: { stubs },
    });
    const buyerBlock = wrapper.find('[data-testid="company-buyer"]');
    expect(buyerBlock.exists()).toBe(true);
    expect(buyerBlock.text()).toContain('loggedin@example.com');
  });

  it('hides buyer block when no buyerEmail and no buyer name', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps({ company: makeCompany({ buyers: [] }) }),
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="company-buyer"]').exists()).toBe(false);
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
      props: makeProps({ company }),
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
      props: makeProps({ company }),
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="company-billing-address"]');
    expect(addrBlock.text()).toContain('Fallback St 1');
  });

  it('renders the customer order number input', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps({ customerOrderNumber: 'PO-123' }),
      global: { stubs },
    });
    const input = wrapper.find<HTMLInputElement>(
      '[data-testid="checkout-customer-order-number"]',
    );
    expect(input.exists()).toBe(true);
    expect(input.element.value).toBe('PO-123');
  });

  it('emits update:customerOrderNumber when input changes', async () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps(),
      global: { stubs },
    });
    const input = wrapper.find(
      '[data-testid="checkout-customer-order-number"]',
    );
    await input.setValue('PO-2026-0412');
    expect(wrapper.emitted('update:customerOrderNumber')).toBeTruthy();
    expect(wrapper.emitted('update:customerOrderNumber')![0]).toEqual([
      'PO-2026-0412',
    ]);
  });

  it('renders no required marker or validation error (PO number is optional)', async () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps({ customerOrderNumber: '' }),
      global: { stubs },
    });
    const input = wrapper.find(
      '[data-testid="checkout-customer-order-number"]',
    );
    await input.trigger('blur');
    // No inline error appears even when the field is empty and blurred.
    expect(
      wrapper
        .find('[data-testid="checkout-customer-order-number-error"]')
        .exists(),
    ).toBe(false);
    // No "*" required marker in the label.
    expect(wrapper.text()).not.toContain('*');
  });

  it('renders no helper text under the PO number field', () => {
    const wrapper = mount(CheckoutCompanyInfo.default, {
      props: makeProps({ customerOrderNumber: '' }),
      global: { stubs },
    });
    expect(wrapper.text()).not.toContain(
      'checkout.customer_order_number_helper',
    );
  });
});
