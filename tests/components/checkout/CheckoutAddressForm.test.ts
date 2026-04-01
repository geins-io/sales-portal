import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import CheckoutAddressForm from '../../../app/components/checkout/CheckoutAddressForm.vue';

const stubs = {
  Label: { template: '<label><slot /></label>', props: ['for'] },
  Input: {
    template:
      '<input :type="type" :id="id" :disabled="disabled" v-bind="$attrs" @blur="$emit(\'blur\', $event)" />',
    props: [
      'type',
      'id',
      'modelValue',
      'placeholder',
      'autocomplete',
      'disabled',
    ],
    emits: ['update:modelValue', 'blur'],
  },
};

const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'addressLine1',
  'city',
  'country',
  'zip',
];

const OPTIONAL_FIELDS = [
  'company',
  'addressLine2',
  'careOf',
  'phone',
  'mobile',
  'entryCode',
];

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

function mountForm(
  props: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
) {
  return mountComponent(CheckoutAddressForm, {
    props: {
      modelValue: {},
      prefix: 'billing',
      ...props,
    },
    global: { stubs },
    ...options,
  });
}

const FULL_ADDRESS = {
  company: 'Acme Corp',
  firstName: 'John',
  lastName: 'Doe',
  addressLine1: '123 Main St',
  addressLine2: 'Suite 100',
  careOf: 'Jane Smith',
  city: 'Stockholm',
  zip: '11122',
  country: 'Sweden',
  phone: '+46701234567',
  mobile: '+46709876543',
};

describe('CheckoutAddressForm', () => {
  it('renders all address fields', () => {
    const wrapper = mountForm();
    for (const field of ALL_FIELDS) {
      expect(wrapper.find(`[data-testid="billing-${field}"]`).exists()).toBe(
        true,
      );
    }
  });

  it('shows error on blur for empty required field', async () => {
    const wrapper = mountForm();
    const firstNameInput = wrapper.find('[data-testid="billing-firstName"]');
    await firstNameInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(
      wrapper.find('[data-testid="billing-firstName-error"]').exists(),
    ).toBe(true);
  });

  it('does not show error for empty optional field', async () => {
    const wrapper = mountForm();
    const phoneInput = wrapper.find('[data-testid="billing-phone"]');
    await phoneInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="billing-phone-error"]').exists()).toBe(
      false,
    );
  });

  it('emits update:modelValue on input', async () => {
    const wrapper = mountForm();
    // Find Input stub components and locate the firstName one by data-testid
    const inputComponents = wrapper.findAllComponents(stubs.Input);
    const firstNameComp = inputComponents.find(
      (c) => c.attributes('data-testid') === 'billing-firstName',
    );
    expect(firstNameComp).toBeTruthy();
    firstNameComp!.vm.$emit('update:modelValue', 'John');
    await wrapper.vm.$nextTick();
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted!.length).toBeGreaterThan(0);
    const lastPayload = emitted![emitted!.length - 1]![0] as Record<
      string,
      unknown
    >;
    expect(lastPayload.firstName).toBe('John');
  });

  it('validate() returns false with empty required fields', () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as unknown as { validate: () => boolean };
    expect(vm.validate()).toBe(false);
  });

  it('validate() returns true with all required fields', () => {
    const wrapper = mountForm({
      modelValue: {
        firstName: 'John',
        lastName: 'Doe',
        addressLine1: '123 Main St',
        city: 'Stockholm',
        country: 'Sweden',
        zip: '11122',
      },
    });
    const vm = wrapper.vm as unknown as { validate: () => boolean };
    expect(vm.validate()).toBe(true);
  });

  it('disabled prop disables all inputs', () => {
    const wrapper = mountForm({ disabled: true });
    const inputs = wrapper.findAll('input');
    for (const input of inputs) {
      expect(input.attributes('disabled')).toBeDefined();
    }
  });

  it('uses prefix for data-testid attributes', () => {
    const wrapper = mountForm({ prefix: 'shipping' });
    expect(wrapper.find('[data-testid="shipping-address-form"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="shipping-firstName"]').exists()).toBe(
      true,
    );
  });

  it('shows all field errors after validate() call with empty form', async () => {
    const wrapper = mountForm();
    const vm = wrapper.vm as unknown as { validate: () => boolean };
    vm.validate();
    await wrapper.vm.$nextTick();
    for (const field of REQUIRED_FIELDS) {
      expect(
        wrapper.find(`[data-testid="billing-${field}-error"]`).exists(),
      ).toBe(true);
    }
  });

  // --- Readonly mode tests ---

  describe('readonly mode', () => {
    it('when readonly=false, renders input fields (existing behavior)', () => {
      const wrapper = mountForm({ readonly: false });
      const inputs = wrapper.findAll('input');
      expect(inputs.length).toBeGreaterThan(0);
      expect(wrapper.find('[data-testid="address-readonly"]').exists()).toBe(
        false,
      );
    });

    it('when readonly=true, does NOT render input fields', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: FULL_ADDRESS,
      });
      const inputs = wrapper.findAll('input');
      expect(inputs.length).toBe(0);
    });

    it('when readonly=true, renders address as static text', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: FULL_ADDRESS,
      });
      expect(wrapper.find('[data-testid="address-readonly"]').exists()).toBe(
        true,
      );
    });

    it('when readonly=true, displays company name when present', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: FULL_ADDRESS,
      });
      const readonlyEl = wrapper.find('[data-testid="address-readonly"]');
      expect(readonlyEl.text()).toContain('Acme Corp');
    });

    it('when readonly=true, displays first + last name', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: FULL_ADDRESS,
      });
      const readonlyEl = wrapper.find('[data-testid="address-readonly"]');
      expect(readonlyEl.text()).toContain('John');
      expect(readonlyEl.text()).toContain('Doe');
    });

    it('when readonly=true, displays address lines', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: FULL_ADDRESS,
      });
      const readonlyEl = wrapper.find('[data-testid="address-readonly"]');
      expect(readonlyEl.text()).toContain('123 Main St');
      expect(readonlyEl.text()).toContain('Suite 100');
      expect(readonlyEl.text()).toContain('Jane Smith');
    });

    it('when readonly=true, displays city, zip, country', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: FULL_ADDRESS,
      });
      const readonlyEl = wrapper.find('[data-testid="address-readonly"]');
      expect(readonlyEl.text()).toContain('Stockholm');
      expect(readonlyEl.text()).toContain('11122');
      expect(readonlyEl.text()).toContain('Sweden');
    });

    it('when readonly=true, renders "Change company details" link', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: FULL_ADDRESS,
      });
      const link = wrapper.find('[data-testid="address-change-link"]');
      expect(link.exists()).toBe(true);
      expect(link.text()).toContain('checkout.change_company_details');
    });

    it('when readonly=true, link points to /portal/account via localePath', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: FULL_ADDRESS,
      });
      const link = wrapper.find('[data-testid="address-change-link"]');
      // localePath mock prepends /se/en
      expect(link.attributes('href')).toBe('/se/en/portal/account');
    });

    it('when readonly=true with partial address data, gracefully handles missing fields', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: {
          firstName: 'John',
          lastName: 'Doe',
          city: 'Stockholm',
        },
      });
      const readonlyEl = wrapper.find('[data-testid="address-readonly"]');
      expect(readonlyEl.exists()).toBe(true);
      expect(readonlyEl.text()).toContain('John');
      expect(readonlyEl.text()).toContain('Doe');
      expect(readonlyEl.text()).toContain('Stockholm');
      // Should NOT contain undefined or null text
      expect(readonlyEl.text()).not.toContain('undefined');
      expect(readonlyEl.text()).not.toContain('null');
    });

    it('when readonly=true with empty modelValue, shows no text (no crash)', () => {
      const wrapper = mountForm({
        readonly: true,
        modelValue: {},
      });
      const readonlyEl = wrapper.find('[data-testid="address-readonly"]');
      expect(readonlyEl.exists()).toBe(true);
      // Should not crash, should not contain undefined/null
      expect(readonlyEl.text()).not.toContain('undefined');
      expect(readonlyEl.text()).not.toContain('null');
    });
  });
});
