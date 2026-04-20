// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

// ---------------------------------------------------------------------------
// Nuxt auto-import stubs
// ---------------------------------------------------------------------------
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('useHead', vi.fn());

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

vi.stubGlobal('computed', computed);

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
// useFetch mock — controls profile data and pending state
// ---------------------------------------------------------------------------
let mockProfileData: { profile: Record<string, unknown> } | null = {
  profile: {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
  },
};
let mockProfilePending = false;

vi.mock('#app/composables/fetch', () => ({
  useFetch: vi.fn(() => ({
    data: ref(mockProfileData),
    pending: ref(mockProfilePending),
  })),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', () => ({
  data: ref(mockProfileData),
  pending: ref(mockProfilePending),
}));

// ---------------------------------------------------------------------------
// Stubs for child components
// ---------------------------------------------------------------------------
const mockSubmit = vi.fn().mockResolvedValue(undefined);

const stubs = {
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  ProfileForm: {
    name: 'ProfileForm',
    template: '<div data-testid="profile-form" />',
    props: ['profile', 'hideSubmitButton'],
    emits: ['saved'],
    setup() {
      return { submit: mockSubmit };
    },
  },
  ChangePasswordForm: {
    template: '<div data-testid="change-password-form" />',
  },
  Icon: {
    template: '<span></span>',
    props: ['name'],
  },
  NuxtIcon: {
    template: '<span></span>',
    props: ['name'],
  },
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled'],
    emits: ['click'],
  },
};

// ---------------------------------------------------------------------------
// Import page after stubs are set
// ---------------------------------------------------------------------------
const AccountPage = await import('../../../app/pages/portal/account.vue');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Account Page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockProfileData = {
      profile: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      },
    };
    mockProfilePending = false;
    mockSubmit.mockClear();
  });

  it('renders sidebar with highlighted Your account item', () => {
    const wrapper = mount(AccountPage.default, { global: { stubs } });
    const sidebar = wrapper.find('[data-testid="account-sidebar"]');
    expect(sidebar.exists()).toBe(true);
    const item = wrapper.find('[data-testid="account-sidebar-item"]');
    expect(item.exists()).toBe(true);
    expect(item.attributes('aria-current')).toBe('page');
  });

  it('renders main content area with title and subtitle', () => {
    const wrapper = mount(AccountPage.default, { global: { stubs } });
    const main = wrapper.find('[data-testid="account-main"]');
    expect(main.exists()).toBe(true);
    expect(main.text()).toContain('portal.account.page_title');
    expect(main.text()).toContain('portal.account.page_subtitle');
  });

  it('renders top-right Save button with save icon', () => {
    const wrapper = mount(AccountPage.default, { global: { stubs } });
    const button = wrapper.find('[data-testid="account-save-button"]');
    expect(button.exists()).toBe(true);
  });

  it('renders unified panel with both sections separated by hr', () => {
    const wrapper = mount(AccountPage.default, { global: { stubs } });
    const panel = wrapper.find('[data-testid="account-panel"]');
    expect(panel.exists()).toBe(true);
    expect(panel.find('[data-testid="account-general-section"]').exists()).toBe(
      true,
    );
    expect(
      panel.find('[data-testid="account-password-section"]').exists(),
    ).toBe(true);
    expect(panel.find('hr').exists()).toBe(true);
  });

  it('shows loading state with i18n common.loading key when fetching', () => {
    mockProfilePending = true;
    mockProfileData = null;
    const wrapper = mount(AccountPage.default, { global: { stubs } });
    expect(wrapper.find('[data-testid="account-panel"]').text()).toContain(
      'common.loading',
    );
  });

  it('passes hideSubmitButton=true to ProfileForm so external button drives submit', () => {
    const wrapper = mount(AccountPage.default, { global: { stubs } });
    const profileForm = wrapper.findComponent({ name: 'ProfileForm' });
    expect(profileForm.exists()).toBe(true);
    expect(profileForm.props('hideSubmitButton')).toBe(true);
  });

  it('Save button is disabled while pending', () => {
    mockProfilePending = true;
    const wrapper = mount(AccountPage.default, { global: { stubs } });
    const button = wrapper.find('[data-testid="account-save-button"]');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('Save button click invokes ProfileForm submit via ref', async () => {
    const wrapper = mount(AccountPage.default, { global: { stubs } });
    await wrapper.find('[data-testid="account-save-button"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(mockSubmit).toHaveBeenCalled();
  });
});
