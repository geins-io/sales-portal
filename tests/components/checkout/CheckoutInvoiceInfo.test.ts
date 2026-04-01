import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import CheckoutInvoiceInfo from '../../../app/components/checkout/CheckoutInvoiceInfo.vue';

const stubs = {
  Card: {
    template: '<div data-testid="card"><slot /></div>',
  },
  CardHeader: {
    template: '<div data-testid="card-header"><slot /></div>',
  },
  CardTitle: {
    template: '<h3><slot /></h3>',
  },
  CardContent: {
    template: '<div data-testid="card-content"><slot /></div>',
  },
  Input: {
    template:
      '<input :value="modelValue" data-testid="input-stub" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
  Label: {
    template: '<label><slot /></label>',
  },
  FileText: {
    template: '<span class="icon-file-text"></span>',
  },
};

function mountInvoiceInfo(props: {
  poNumber?: string;
  currency?: string | null;
  paymentTerms?: { name: string; description?: string; days?: number }[] | null;
}) {
  return mountComponent(CheckoutInvoiceInfo, {
    props: {
      poNumber: '',
      currency: null,
      paymentTerms: null,
      ...props,
    },
    global: { stubs },
  });
}

describe('CheckoutInvoiceInfo', () => {
  it('renders PO number input field', () => {
    const wrapper = mountInvoiceInfo({});
    expect(wrapper.find('[data-testid="checkout-po-number"]').exists()).toBe(
      true,
    );
  });

  it('emits update:poNumber when input value changes', async () => {
    const wrapper = mountInvoiceInfo({});
    const input = wrapper.find('[data-testid="checkout-po-number"]');
    await input.setValue('PO-12345');
    expect(wrapper.emitted('update:poNumber')).toBeTruthy();
    expect(wrapper.emitted('update:poNumber')![0]).toEqual(['PO-12345']);
  });

  it('displays pre-filled PO number from prop', () => {
    const wrapper = mountInvoiceInfo({ poNumber: 'PO-99999' });
    const input = wrapper.find<HTMLInputElement>(
      '[data-testid="checkout-po-number"]',
    );
    expect(input.element.value).toBe('PO-99999');
  });

  it('shows currency code when provided', () => {
    const wrapper = mountInvoiceInfo({ currency: 'SEK' });
    expect(wrapper.text()).toContain('SEK');
  });

  it('hides currency display when currency is null', () => {
    const wrapper = mountInvoiceInfo({ currency: null });
    expect(wrapper.find('[data-testid="checkout-currency"]').exists()).toBe(
      false,
    );
  });

  it('renders payment terms table when terms are provided', () => {
    const wrapper = mountInvoiceInfo({
      paymentTerms: [
        { name: 'Net 30', days: 30 },
        { name: 'Net 60', days: 60 },
      ],
    });
    expect(
      wrapper.find('[data-testid="checkout-payment-terms"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain('Net 30');
    expect(wrapper.text()).toContain('30');
    expect(wrapper.text()).toContain('Net 60');
    expect(wrapper.text()).toContain('60');
  });

  it('hides payment terms table when terms is null', () => {
    const wrapper = mountInvoiceInfo({ paymentTerms: null });
    expect(
      wrapper.find('[data-testid="checkout-payment-terms"]').exists(),
    ).toBe(false);
  });

  it('hides payment terms table when terms is empty array', () => {
    const wrapper = mountInvoiceInfo({ paymentTerms: [] });
    expect(
      wrapper.find('[data-testid="checkout-payment-terms"]').exists(),
    ).toBe(false);
  });

  it('renders without crashing with all null props (SSR safety)', () => {
    const wrapper = mountInvoiceInfo({
      poNumber: '',
      currency: null,
      paymentTerms: null,
    });
    expect(wrapper.find('[data-testid="checkout-invoice-info"]').exists()).toBe(
      true,
    );
  });
});
