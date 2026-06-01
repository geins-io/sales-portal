// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import type { Company } from '../../../../../shared/types/company';

// ---------------------------------------------------------------------------
// Nuxt stubs
// ---------------------------------------------------------------------------
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('useHead', vi.fn());

vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerSeoMeta: vi.fn(),
  useSeoMeta: vi.fn(),
}));

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

vi.stubGlobal('computed', computed);

vi.mock('../../../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: computed(() => 'se'),
    currentLocale: computed(() => 'en'),
    localePath: (path: string) =>
      `/se/en${path.startsWith('/') ? path : '/' + path}`,
    getCleanPath: () => '/',
    switchLocale: vi.fn(),
    switchMarket: vi.fn(),
  }),
}));

vi.stubGlobal('useLocaleMarket', () => ({
  currentMarket: computed(() => 'se'),
  currentLocale: computed(() => 'en'),
  localePath: (path: string) =>
    `/se/en${path.startsWith('/') ? path : '/' + path}`,
  getCleanPath: () => '/',
  switchLocale: vi.fn(),
  switchMarket: vi.fn(),
}));

// ---------------------------------------------------------------------------
// createError stub
// ---------------------------------------------------------------------------
const mockCreateError = vi.fn(
  (opts: { statusCode: number; fatal?: boolean }) => {
    const err = new Error(`H3Error: ${opts.statusCode}`);
    (err as unknown as Record<string, unknown>).statusCode = opts.statusCode;
    (err as unknown as Record<string, unknown>).fatal = opts.fatal;
    return err;
  },
);

vi.stubGlobal('createError', mockCreateError);
vi.mock('#app/composables/error', () => ({
  createError: (opts: { statusCode: number; fatal?: boolean }) =>
    mockCreateError(opts),
  showError: vi.fn(),
  useError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// useFetch mock
// ---------------------------------------------------------------------------
let mockCompanyData: { company: Company } | null = null;
let mockPending = false;
let mockError: Error | null = null;

vi.mock('#app/composables/fetch', () => ({
  useFetch: vi.fn(() => ({
    data: ref(mockCompanyData),
    pending: ref(mockPending),
    error: ref(mockError),
    refresh: vi.fn(),
    execute: vi.fn(),
  })),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', () => ({
  data: ref(mockCompanyData),
  pending: ref(mockPending),
  error: ref(mockError),
  refresh: vi.fn(),
  execute: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Component stubs
// ---------------------------------------------------------------------------
const stubs = {
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  PortalOrganisationShell: {
    template: '<div data-testid="portal-organisation-shell"><slot /></div>',
  },
  OrganisationPersonsTable: {
    template: '<div data-testid="persons-table"></div>',
    props: ['buyers'],
  },
};

// ---------------------------------------------------------------------------
// Import page after stubs
// ---------------------------------------------------------------------------
const PersonsPage =
  await import('../../../../../app/pages/portal/organisation/persons.vue');

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-1',
    name: 'Acme AB',
    vatNumber: null,
    exVat: false,
    limitedProductAccess: false,
    addresses: [],
    buyers: [
      {
        id: 'buyer-1',
        internalId: '8421',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+46701234567',
        companyId: 'company-1',
        active: true,
        restrictToDedicatedPriceLists: false,
      },
    ],
    ...overrides,
  };
}

describe('Portal Organisation persons page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockCompanyData = null;
    mockPending = false;
    mockError = null;
    mockCreateError.mockClear();
  });

  it('renders loading state when pending', async () => {
    mockPending = true;
    const wrapper = mount(PersonsPage.default, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="organisation-loading"]').exists()).toBe(
      true,
    );
  });

  it('renders error state when error is set', async () => {
    mockPending = false;
    mockError = new Error('network failure');
    const wrapper = mount(PersonsPage.default, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="organisation-error"]').exists()).toBe(
      true,
    );
  });

  it('renders OrganisationPersonsTable on success', async () => {
    mockPending = false;
    mockError = null;
    mockCompanyData = { company: makeCompany() };
    const wrapper = mount(PersonsPage.default, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="persons-table"]').exists()).toBe(true);
  });
});
