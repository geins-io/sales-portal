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
  Input: {
    template:
      '<input :value="modelValue" :type="type" :min="min" :disabled="disabled" data-testid="input-stub" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: [
      'modelValue',
      'type',
      'min',
      'disabled',
      'maxlength',
      'placeholder',
    ],
    emits: ['update:modelValue'],
  },
  Label: { template: '<label><slot /></label>' },
  CheckoutCardHeader: {
    template: '<div data-testid="checkout-card-header" />',
    props: ['icon', 'title'],
  },
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

function makeProps(
  overrides: Partial<
    InstanceType<typeof CheckoutDeliveryInfo.default>['$props']
  > = {},
) {
  return {
    company: makeCompany(),
    desiredDeliveryDate: '',
    goodsLabel: '',
    disabled: false,
    todayIso: '2026-06-08',
    ...overrides,
  };
}

describe('CheckoutDeliveryInfo', () => {
  it('renders delivery address fields without name or phone', () => {
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
      props: makeProps({ company }),
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="delivery-address"]');
    expect(addrBlock.text()).toContain('Warehouse Road 5');
    expect(addrBlock.text()).toContain('22233 Gothenburg');
    expect(addrBlock.text()).toContain('SE');
    // Name and phone are intentionally omitted on the delivery card.
    expect(addrBlock.text()).not.toContain('Delivery Contact');
    expect(addrBlock.text()).not.toContain('+46-70-000-0002');
  });

  it('renders delivery address section label', () => {
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps(),
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="delivery-address-label"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="delivery-address-label"]').text()).toBe(
      'checkout.delivery_address',
    );
  });

  it('uses first delivery/shipping type address when available', () => {
    const billingAddr = makeAddress({
      addressId: 'addr-billing',
      addressType: 'billing',
      addressLine1: 'Billing Street 1',
    });
    const shippingAddr = makeAddress({
      addressId: 'addr-shipping',
      addressType: 'shipping',
      addressLine1: 'Shipping Street 9',
    });
    const company = makeCompany({ addresses: [billingAddr, shippingAddr] });
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps({ company }),
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="delivery-address"]');
    expect(addrBlock.text()).toContain('Shipping Street 9');
    expect(addrBlock.text()).not.toContain('Billing Street 1');
  });

  it('falls back to billing address when no delivery/shipping address found', () => {
    const billingAddr = makeAddress({
      addressId: 'addr-billing',
      addressType: 'billing',
      addressLine1: 'Fallback Billing Street 42',
    });
    const company = makeCompany({ addresses: [billingAddr] });
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps({ company }),
      global: { stubs },
    });
    const addrBlock = wrapper.find('[data-testid="delivery-address"]');
    expect(addrBlock.text()).toContain('Fallback Billing Street 42');
  });

  it('renders desired delivery date input', () => {
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps(),
      global: { stubs },
    });
    expect(
      wrapper.find('[data-testid="checkout-desired-delivery-date"]').exists(),
    ).toBe(true);
  });

  it('binds :min to todayIso on the date input', () => {
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps({ todayIso: '2026-07-01' }),
      global: { stubs },
    });
    const dateInput = wrapper.find<HTMLInputElement>(
      '[data-testid="checkout-desired-delivery-date"]',
    );
    expect(dateInput.attributes('min')).toBe('2026-07-01');
  });

  it('displays pre-filled desiredDeliveryDate', () => {
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps({ desiredDeliveryDate: '2026-09-15' }),
      global: { stubs },
    });
    const input = wrapper.find<HTMLInputElement>(
      '[data-testid="checkout-desired-delivery-date"]',
    );
    expect(input.element.value).toBe('2026-09-15');
  });

  it('emits update:desiredDeliveryDate when date input changes', async () => {
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps(),
      global: { stubs },
    });
    const input = wrapper.find(
      '[data-testid="checkout-desired-delivery-date"]',
    );
    await input.setValue('2026-10-01');
    expect(wrapper.emitted('update:desiredDeliveryDate')).toBeTruthy();
    expect(wrapper.emitted('update:desiredDeliveryDate')![0]).toEqual([
      '2026-10-01',
    ]);
  });

  it('renders goods label input', () => {
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps(),
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="checkout-goods-label"]').exists()).toBe(
      true,
    );
  });

  it('displays pre-filled goodsLabel', () => {
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps({ goodsLabel: 'Store 12' }),
      global: { stubs },
    });
    const input = wrapper.find<HTMLInputElement>(
      '[data-testid="checkout-goods-label"]',
    );
    expect(input.element.value).toBe('Store 12');
  });

  it('emits update:goodsLabel when goods label input changes', async () => {
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps(),
      global: { stubs },
    });
    const input = wrapper.find('[data-testid="checkout-goods-label"]');
    await input.setValue('Dock B');
    expect(wrapper.emitted('update:goodsLabel')).toBeTruthy();
    expect(wrapper.emitted('update:goodsLabel')![0]).toEqual(['Dock B']);
  });

  it('passes disabled prop to both date and goods label inputs', () => {
    const wrapper = mount(CheckoutDeliveryInfo.default, {
      props: makeProps({ disabled: true }),
      global: { stubs },
    });
    const dateInput = wrapper.find<HTMLInputElement>(
      '[data-testid="checkout-desired-delivery-date"]',
    );
    const goodsInput = wrapper.find<HTMLInputElement>(
      '[data-testid="checkout-goods-label"]',
    );
    expect(dateInput.attributes('disabled')).toBeDefined();
    expect(goodsInput.attributes('disabled')).toBeDefined();
  });
});
