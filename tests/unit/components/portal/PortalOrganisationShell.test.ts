// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';

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

vi.stubGlobal('useRoute', () => ({
  path: '/portal/organisation',
  params: {},
  query: {},
  hash: '',
  fullPath: '/portal/organisation',
  name: 'portal-organisation',
}));

vi.mock('#app/composables/router', () => ({
  useRoute: () => ({
    path: '/portal/organisation',
    params: {},
    query: {},
    hash: '',
    fullPath: '/portal/organisation',
    name: 'portal-organisation',
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

const mockLocaleMarket = {
  currentMarket: computed(() => 'se'),
  currentLocale: computed(() => 'en'),
  localePath: (path: string) =>
    `/se/en${path.startsWith('/') ? path : '/' + path}`,
  getCleanPath: () => '/',
  switchLocale: vi.fn(),
  switchMarket: vi.fn(),
};

vi.mock('../../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => mockLocaleMarket,
}));

vi.mock('../../../../app/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: ref(null),
    tenantId: computed(() => 'test-tenant'),
    hostname: computed(() => 'test.example.com'),
    isLoading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    mode: computed(() => 'commerce'),
    features: computed(() => ({})),
    hasFeature: () => false,
    branding: computed(() => ({ name: 'Test' })),
    theme: computed(() => null),
    market: computed(() => ''),
    availableLocales: computed(() => ['sv']),
    availableMarkets: computed(() => []),
  }),
}));

vi.stubGlobal('useLocaleMarket', () => mockLocaleMarket);

const stubs = {
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
};

const PortalOrganisationShell =
  await import('../../../../app/components/portal/PortalOrganisationShell.vue');

describe('PortalOrganisationShell', () => {
  it('renders a nav with aria-label', () => {
    const wrapper = mount(PortalOrganisationShell.default, {
      global: { stubs },
      slots: { default: '<div>content</div>' },
    });
    const nav = wrapper.find('nav');
    expect(nav.exists()).toBe(true);
    expect(nav.attributes('aria-label')).toBe('portal.org.sidebar_aria');
  });

  it('renders General settings link pointing to /portal/organisation', () => {
    const wrapper = mount(PortalOrganisationShell.default, {
      global: { stubs },
      slots: { default: '<div>content</div>' },
    });
    const links = wrapper.findAll('a');
    const hrefs = links.map((l) => l.attributes('href'));
    expect(hrefs.some((h) => h?.includes('/portal/organisation'))).toBe(true);
  });

  it('renders Persons link pointing to /portal/organisation/persons', () => {
    const wrapper = mount(PortalOrganisationShell.default, {
      global: { stubs },
      slots: { default: '<div>content</div>' },
    });
    const links = wrapper.findAll('a');
    const hrefs = links.map((l) => l.attributes('href'));
    expect(hrefs.some((h) => h?.includes('/portal/organisation/persons'))).toBe(
      true,
    );
  });

  it('does NOT render a Roles item', () => {
    const wrapper = mount(PortalOrganisationShell.default, {
      global: { stubs },
      slots: { default: '<div>content</div>' },
    });
    expect(wrapper.text().toLowerCase()).not.toContain('roles');
    expect(wrapper.text()).not.toContain('portal.org.sidebar.roles');
  });

  it('renders exactly two nav links', () => {
    const wrapper = mount(PortalOrganisationShell.default, {
      global: { stubs },
      slots: { default: '<div>content</div>' },
    });
    expect(wrapper.findAll('a')).toHaveLength(2);
  });

  it('renders slot content', () => {
    const wrapper = mount(PortalOrganisationShell.default, {
      global: { stubs },
      slots: { default: '<div data-testid="slot-content">hello</div>' },
    });
    expect(wrapper.find('[data-testid="slot-content"]').exists()).toBe(true);
  });
});
