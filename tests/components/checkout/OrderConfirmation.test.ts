import { describe, it, expect, beforeEach } from 'vitest';
import type { AuthUser } from '@geins/types';
import { mountComponent } from '../../utils/component';
import OrderConfirmation from '../../../app/components/checkout/OrderConfirmation.vue';
import { useAuthStore } from '../../../app/stores/auth';

const PUBLIC_ID = '8dd16643-aaaa-bbbb-cccc-000000000000';

const SIGNED_IN: AuthUser = { userId: '1', username: 'buyer@example.com' };

function mountConfirmation(props: Record<string, unknown> = {}) {
  return mountComponent(OrderConfirmation, { props });
}

/**
 * The confirmation's own top part. The order itself (rows, amounts, addresses)
 * renders below it with the portal order page's components.
 */
describe('OrderConfirmation', () => {
  beforeEach(() => {
    // Sign out: the Pinia store is shared across this file's tests.
    useAuthStore().user = null;
  });

  it('renders the order-confirmed heading', () => {
    const wrapper = mountConfirmation();
    expect(wrapper.text()).toContain('order_confirmation.thank_you');
    expect(wrapper.text()).toContain(
      'order_confirmation.confirmation_subtitle',
    );
  });

  it('renders the check icon using the theme primary token', () => {
    const icon = mountConfirmation().find('[data-testid="confirm-icon"]');
    expect(icon.exists()).toBe(true);
    expect(icon.classes().join(' ')).toContain('text-primary');
  });

  it('shows the order number it is given', () => {
    const badge = mountConfirmation({ orderNumber: '1433' }).find(
      '[data-testid="order-number"]',
    );
    expect(badge.text()).toContain('1433');
  });

  it('shows no order number badge without one', () => {
    expect(
      mountConfirmation().find('[data-testid="order-number"]').exists(),
    ).toBe(false);
  });

  it('shows no portal button to a signed-out buyer', () => {
    expect(
      mountConfirmation({ publicOrderId: PUBLIC_ID })
        .find('[data-testid="view-order-cta"]')
        .exists(),
    ).toBe(false);
  });

  it('shows the portal button to a signed-in buyer', () => {
    useAuthStore().user = SIGNED_IN;
    expect(
      mountConfirmation({ publicOrderId: PUBLIC_ID })
        .find('[data-testid="view-order-cta"]')
        .exists(),
    ).toBe(true);
  });

  it("links to the order's own page, waiting for it", () => {
    useAuthStore().user = SIGNED_IN;
    const cta = mountConfirmation({ publicOrderId: PUBLIC_ID }).find(
      '[data-testid="view-order-cta"]',
    );
    expect(cta.attributes('href')).toBe(
      `/se/en/portal/orders/${PUBLIC_ID}?awaiting=${PUBLIC_ID}`,
    );
  });

  it('links to the order list when there is no order id at all', () => {
    useAuthStore().user = SIGNED_IN;
    const cta = mountConfirmation().find('[data-testid="view-order-cta"]');
    expect(cta.attributes('href')).toBe('/se/en/portal/orders');
  });

  it('renders the back-to-store link below the card', () => {
    const back = mountConfirmation().find('[data-testid="back-to-store"]');
    expect(back.attributes('href')).toBe('/se/en/');
  });

  it('never shows the legacy "order not found" text', () => {
    expect(mountConfirmation().text()).not.toContain(
      'order_confirmation.order_not_found',
    );
  });
});
