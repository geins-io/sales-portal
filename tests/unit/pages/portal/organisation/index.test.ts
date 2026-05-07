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
// createError stub — capture thrown errors
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
// useFetch mock — controlled per test
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
  OrganisationGeneralSettings: {
    template:
      '<div data-testid="organisation-general-settings" :data-company-id="company.id"></div>',
    props: ['company'],
  },
  Icon: {
    template: '<span class="icon" :data-name="name"></span>',
    props: ['name'],
  },
};

// ---------------------------------------------------------------------------
// Import page after stubs are in place
// ---------------------------------------------------------------------------
const OrganisationIndexPage =
  await import('../../../../../app/pages/portal/organisation/index.vue');

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-42',
    name: 'Test Corp',
    vatNumber: 'SE123456789001',
    exVat: false,
    limitedProductAccess: false,
    addresses: [],
    buyers: [],
    ...overrides,
  };
}

describe('Portal Organisation index page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockCompanyData = null;
    mockPending = false;
    mockError = null;
    mockCreateError.mockClear();
  });

  it('renders loading state when pending is true', async () => {
    mockPending = true;
    mockCompanyData = null;
    const wrapper = mount(OrganisationIndexPage.default, {
      global: { stubs },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="organisation-loading"]').exists()).toBe(
      true,
    );
  });

  it('renders error state when error is set', async () => {
    mockPending = false;
    mockError = new Error('network failure');
    const wrapper = mount(OrganisationIndexPage.default, {
      global: { stubs },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="organisation-error"]').exists()).toBe(
      true,
    );
  });

  it('renders OrganisationGeneralSettings on success', async () => {
    mockPending = false;
    mockError = null;
    mockCompanyData = { company: makeCompany() };
    const wrapper = mount(OrganisationIndexPage.default, {
      global: { stubs },
    });
    await flushPromises();
    expect(
      wrapper.find('[data-testid="organisation-general-settings"]').exists(),
    ).toBe(true);
  });

  it('passes company data to OrganisationGeneralSettings', async () => {
    mockPending = false;
    mockError = null;
    mockCompanyData = { company: makeCompany({ id: 'company-42' }) };
    const wrapper = mount(OrganisationIndexPage.default, {
      global: { stubs },
    });
    await flushPromises();
    const el = wrapper.find('[data-testid="organisation-general-settings"]');
    expect(el.attributes('data-company-id')).toBe('company-42');
  });

  it('calls createError with 404 when server returns a 404 error', async () => {
    mockPending = false;
    const notFoundError = new Error('Not Found') as Error & {
      statusCode: number;
    };
    notFoundError.statusCode = 404;
    mockError = notFoundError;
    mockCompanyData = null;
    try {
      mount(OrganisationIndexPage.default, {
        global: { stubs },
      });
      await flushPromises();
    } catch {
      // expected — createError throws
    }
    expect(mockCreateError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    );
  });
});
