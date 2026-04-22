// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';

import { mountComponent } from '../../utils/component';
import PortalPendingApprovalBanner from '../../../app/components/portal/PortalPendingApprovalBanner.vue';

let currentQuery: Record<string, string> = {};

vi.mock('#app/composables/router', () => ({
  useRoute: () => ({
    query: currentQuery,
    path: '/portal',
    params: {},
    hash: '',
    fullPath: '/portal',
    name: 'portal',
  }),
}));

function mountBanner(query: Record<string, string> = {}) {
  currentQuery = query;
  return mountComponent(PortalPendingApprovalBanner);
}

describe('PortalPendingApprovalBanner', () => {
  it('renders when route.query.applied is "1"', () => {
    const wrapper = mountBanner({ applied: '1' });
    expect(
      wrapper.find('[data-testid="portal-pending-approval-banner"]').exists(),
    ).toBe(true);
  });

  it('does not render when the applied query param is absent', () => {
    const wrapper = mountBanner({});
    expect(
      wrapper.find('[data-testid="portal-pending-approval-banner"]').exists(),
    ).toBe(false);
  });

  it('does not render when applied is present but not "1"', () => {
    const wrapper = mountBanner({ applied: 'false' });
    expect(
      wrapper.find('[data-testid="portal-pending-approval-banner"]').exists(),
    ).toBe(false);
  });

  it('renders the title, body, and dismiss button with i18n keys', () => {
    const wrapper = mountBanner({ applied: '1' });
    const text = wrapper.text();
    expect(text).toContain('apply.pending_approval_title');
    expect(text).toContain('apply.pending_approval_body');
    const dismiss = wrapper.find(
      '[data-testid="portal-pending-approval-dismiss"]',
    );
    expect(dismiss.exists()).toBe(true);
    expect(dismiss.attributes('aria-label')).toBe('apply.dismiss_banner');
  });

  it('hides the banner when the dismiss button is clicked', async () => {
    const wrapper = mountBanner({ applied: '1' });
    await wrapper
      .find('[data-testid="portal-pending-approval-dismiss"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="portal-pending-approval-banner"]').exists(),
    ).toBe(false);
  });
});
