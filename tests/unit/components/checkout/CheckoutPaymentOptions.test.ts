// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { PaymentOptionType } from '#shared/types/commerce';

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

const CheckoutPaymentOptions =
  await import('../../../../app/components/checkout/CheckoutPaymentOptions.vue');

function makeOption(
  overrides: Partial<PaymentOptionType> = {},
): PaymentOptionType {
  return {
    id: 1,
    name: undefined,
    displayName: undefined,
    feeIncVat: 0,
    feeExVat: 0,
    isDefault: true,
    isSelected: true,
    ...overrides,
  } as PaymentOptionType;
}

function renderLabel(option: PaymentOptionType): string {
  const wrapper = mount(CheckoutPaymentOptions.default, {
    props: { options: [option], modelValue: option.id, disabled: false },
  });
  return wrapper.find(`[data-testid="payment-option-${option.id}"]`).text();
}

describe('CheckoutPaymentOptions paymentLabel fallback', () => {
  it('uses displayName when present', () => {
    expect(renderLabel(makeOption({ displayName: 'Bank Transfer' }))).toContain(
      'Bank Transfer',
    );
  });

  it('falls back to name when displayName is empty', () => {
    expect(
      renderLabel(makeOption({ displayName: '', name: 'Klarna Invoice' })),
    ).toContain('Klarna Invoice');
  });

  it('uses the localized paymentType label when both display fields are empty', () => {
    expect(
      renderLabel(
        makeOption({
          displayName: undefined,
          name: undefined,
          // GeinsPaymentType enum value
          paymentType: 'KLARNA' as PaymentOptionType['paymentType'],
        }),
      ),
    ).toContain('checkout.payment_types.klarna');
  });

  it('defaults to the invoice key when nothing identifies the option', () => {
    expect(renderLabel(makeOption())).toContain(
      'checkout.payment_types.invoice',
    );
    expect(renderLabel(makeOption())).not.toContain('checkout.payment_method');
  });

  it('does not leak the section heading key when the option is unconfigured', () => {
    const wrapper = mount(CheckoutPaymentOptions.default, {
      props: {
        options: [makeOption({ id: 7 })],
        modelValue: 7,
        disabled: false,
      },
    });
    const row = wrapper.find('[data-testid="payment-option-7"]');
    expect(row.text()).not.toBe('checkout.payment_method');
    expect(row.text()).not.toContain('Betalningsmetod');
  });
});
