import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PromoCodeInput from '../../../app/components/cart/PromoCodeInput.vue';

const iconStub = {
  template: '<span class="icon" />',
};
const stubs = { X: iconStub };

describe('PromoCodeInput', () => {
  const defaultProps = {
    activeCode: null as string | null,
    loading: false,
  };

  it('renders with data-testid', () => {
    const wrapper = mountComponent(PromoCodeInput, {
      props: defaultProps,
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="promo-code-input"]').exists()).toBe(
      true,
    );
  });

  it('renders input and apply button when no active code', () => {
    const wrapper = mountComponent(PromoCodeInput, {
      props: defaultProps,
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="promo-input"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="promo-apply"]').exists()).toBe(true);
  });

  it('disables apply button when input is empty', () => {
    const wrapper = mountComponent(PromoCodeInput, {
      props: defaultProps,
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="promo-apply"]');
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows active code badge when activeCode is set', () => {
    const wrapper = mountComponent(PromoCodeInput, {
      props: { activeCode: 'SAVE10', loading: false },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('SAVE10');
    expect(wrapper.find('[data-testid="promo-remove"]').exists()).toBe(true);
  });

  it('hides input form when activeCode is set', () => {
    const wrapper = mountComponent(PromoCodeInput, {
      props: { activeCode: 'SAVE10', loading: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="promo-input"]').exists()).toBe(false);
  });

  it('disables input when loading', () => {
    const wrapper = mountComponent(PromoCodeInput, {
      props: { activeCode: null, loading: true },
      global: { stubs },
    });
    const input = wrapper.find('[data-testid="promo-input"]');
    expect((input.element as HTMLInputElement).disabled).toBe(true);
  });
});
