import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import LoginPage from '../../../app/pages/login.vue';
import { createPinia, setActivePinia } from 'pinia';

const stubs = {
  AuthCard: {
    template:
      '<div data-testid="auth-card" :data-default-view="defaultView"><slot name="login" /><slot name="register" /></div>',
    props: ['defaultView'],
    emits: ['close'],
  },
  AuthAuthCard: {
    template:
      '<div data-testid="auth-card" :data-default-view="defaultView"><slot name="login" /><slot name="register" /></div>',
    props: ['defaultView'],
    emits: ['close'],
  },
  LoginForm: { template: '<div data-testid="login-form" />' },
  AuthLoginForm: { template: '<div data-testid="login-form" />' },
  RegisterForm: { template: '<div data-testid="register-form" />' },
  AuthRegisterForm: { template: '<div data-testid="register-form" />' },
};

// Override the #app/composables/router mock from setup-components.ts
// so we can control the route per-test
const currentRoute = ref({
  path: '/login',
  params: {},
  query: {} as Record<string, string>,
  hash: '',
  fullPath: '/login',
  name: 'login',
  matched: [],
  redirectedFrom: undefined,
  meta: {},
});

const mockReplace = vi.fn(() => Promise.resolve());

vi.mock('#app/composables/router', () => ({
  useRoute: () => currentRoute.value,
  useRouter: () => ({
    push: vi.fn(() => Promise.resolve()),
    replace: mockReplace,
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    currentRoute,
  }),
  defineNuxtRouteMiddleware: vi.fn(),
  navigateTo: vi.fn(),
  abortNavigation: vi.fn(),
  addRouteMiddleware: vi.fn(),
  setPageLayout: vi.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    currentRoute.value = {
      path: '/login',
      params: {},
      query: {},
      hash: '',
      fullPath: '/login',
      name: 'login',
      matched: [],
      redirectedFrom: undefined,
      meta: {},
    };
    mockReplace.mockClear();
  });

  it('renders auth card with login and register forms', () => {
    const wrapper = shallowMountComponent(LoginPage, {
      global: { stubs },
    });

    expect(wrapper.find('[data-testid="auth-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="register-form"]').exists()).toBe(true);
  });

  it('defaults to login view when no query param', () => {
    const wrapper = shallowMountComponent(LoginPage, {
      global: { stubs },
    });

    const card = wrapper.find('[data-testid="auth-card"]');
    expect(card.attributes('data-default-view')).toBe('login');
  });

  it('uses register view when ?tab=register', () => {
    currentRoute.value = {
      ...currentRoute.value,
      query: { tab: 'register' },
      fullPath: '/login?tab=register',
    };

    const wrapper = shallowMountComponent(LoginPage, {
      global: { stubs },
    });

    const card = wrapper.find('[data-testid="auth-card"]');
    expect(card.attributes('data-default-view')).toBe('register');
  });
});
