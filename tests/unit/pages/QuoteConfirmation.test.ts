// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';

// ---------------------------------------------------------------------------
// Mock Nuxt auto-imports
// ---------------------------------------------------------------------------
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('useHead', vi.fn());

// Mock Nuxt head composables (requires nuxt instance otherwise)
vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('en'),
  }),
}));

const mockRoute = {
  params: { id: 'quote-uuid-001' },
  query: { quoteNumber: 'Q-1001' },
};
vi.stubGlobal('useRoute', () => mockRoute);

vi.mock('#app/composables/router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
  navigateTo: vi.fn(),
}));

vi.stubGlobal('computed', computed);

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------
const stubs = {
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
};

// ---------------------------------------------------------------------------
// Import page after stubs are set
// ---------------------------------------------------------------------------
const QuoteConfirmationPage =
  await import('../../../app/pages/quote-confirmation/[id].vue');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('QuoteConfirmation page', () => {
  beforeEach(() => {
    mockRoute.params = { id: 'quote-uuid-001' };
    mockRoute.query = { quoteNumber: 'Q-1001' };
  });

  it('renders the confirmation page wrapper', () => {
    const wrapper = mount(QuoteConfirmationPage.default, {
      global: { stubs },
    });

    expect(
      wrapper.find('[data-testid="quote-confirmation-page"]').exists(),
    ).toBe(true);
  });

  it('shows the confirmation title', () => {
    const wrapper = mount(QuoteConfirmationPage.default, {
      global: { stubs },
    });

    const title = wrapper.find('[data-testid="quote-confirmation-title"]');
    expect(title.exists()).toBe(true);
    expect(title.text()).toBe('quote.confirmation_title');
  });

  it('shows the confirmation message', () => {
    const wrapper = mount(QuoteConfirmationPage.default, {
      global: { stubs },
    });

    const message = wrapper.find('[data-testid="quote-confirmation-message"]');
    expect(message.exists()).toBe(true);
    expect(message.text()).toBe('quote.confirmation_message');
  });

  it('shows quote number when provided in query', () => {
    const wrapper = mount(QuoteConfirmationPage.default, {
      global: { stubs },
    });

    const numberEl = wrapper.find('[data-testid="quote-confirmation-number"]');
    expect(numberEl.exists()).toBe(true);
    expect(numberEl.text()).toContain('Q-1001');
  });

  it('hides quote number when not in query', () => {
    mockRoute.query = {};

    const wrapper = mount(QuoteConfirmationPage.default, {
      global: { stubs },
    });

    const numberEl = wrapper.find('[data-testid="quote-confirmation-number"]');
    expect(numberEl.exists()).toBe(false);
  });

  it('renders the portal link pointing to /portal/quotations', () => {
    const wrapper = mount(QuoteConfirmationPage.default, {
      global: { stubs },
    });

    const link = wrapper.find('[data-testid="quote-confirmation-portal-link"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/portal/quotations');
  });

  it('portal link shows the back_to_portal translation key', () => {
    const wrapper = mount(QuoteConfirmationPage.default, {
      global: { stubs },
    });

    const link = wrapper.find('[data-testid="quote-confirmation-portal-link"]');
    expect(link.text()).toBe('quote.back_to_portal');
  });
});
