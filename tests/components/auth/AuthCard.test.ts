import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import AuthCard from '../../../app/components/auth/AuthCard.vue';

const stubs = {
  Card: { template: '<div data-testid="card"><slot /></div>' },
  CardContent: { template: '<div><slot /></div>' },
  Tabs: {
    template:
      '<div data-testid="tabs" :data-model-value="modelValue" :data-default-value="defaultValue"><slot /></div>',
    props: ['modelValue', 'defaultValue'],
  },
  TabsList: { template: '<div data-testid="tabs-list"><slot /></div>' },
  TabsTrigger: {
    template: '<button data-testid="tabs-trigger"><slot /></button>',
    props: ['value'],
  },
  TabsContent: {
    template: '<div data-testid="tabs-content"><slot /></div>',
    props: ['value'],
  },
  BrandLogo: { template: '<div data-testid="brand-logo" />' },
  LayoutBrandLogo: { template: '<div data-testid="brand-logo" />' },
};

describe('AuthCard', () => {
  it('renders the card with logo', () => {
    const wrapper = shallowMountComponent(AuthCard, {
      global: { stubs },
      slots: {
        login: '<div>login form</div>',
        register: '<div>register form</div>',
      },
    });

    expect(wrapper.find('[data-testid="auth-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="brand-logo"]').exists()).toBe(true);
  });

  it('renders tabs with sign-in and register triggers', () => {
    const wrapper = shallowMountComponent(AuthCard, {
      global: { stubs },
      slots: { login: '<div>login</div>', register: '<div>register</div>' },
    });

    expect(wrapper.find('[data-testid="tabs"]').exists()).toBe(true);
    const triggers = wrapper.findAll('[data-testid="tabs-trigger"]');
    expect(triggers.length).toBe(2);
  });

  it('renders login and register tab content slots', () => {
    const wrapper = shallowMountComponent(AuthCard, {
      global: { stubs },
      slots: {
        login: '<div data-testid="login-slot">login form</div>',
        register: '<div data-testid="register-slot">register form</div>',
      },
    });

    expect(wrapper.find('[data-testid="login-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="register-slot"]').exists()).toBe(true);
  });

  it('defaults to login tab', () => {
    const wrapper = shallowMountComponent(AuthCard, {
      global: { stubs },
      slots: { login: '<div>login</div>', register: '<div>register</div>' },
    });

    const tabs = wrapper.find('[data-testid="tabs"]');
    expect(tabs.attributes('data-model-value')).toBe('login');
  });
});
