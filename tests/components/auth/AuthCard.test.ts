import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import AuthCard from '../../../app/components/auth/AuthCard.vue';

// With shallowMount, Card and CardContent get auto-stubbed as empty components.
// We must provide explicit stubs that render their slot content so we can test
// the AuthCard template logic.
const stubs = {
  // Resolve both the import name and the Nuxt auto-import name
  Card: { template: '<div><slot /></div>' },
  UiCard: { template: '<div><slot /></div>' },
  CardContent: { template: '<div><slot /></div>' },
  UiCardContent: { template: '<div><slot /></div>' },
  Separator: { template: '<hr />' },
  UiSeparator: { template: '<hr />' },
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
    props: ['variant'],
  },
  UiButton: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
    props: ['variant'],
  },
};

describe('AuthCard', () => {
  function mountAuthCard(defaultView?: 'login' | 'register') {
    return shallowMountComponent(AuthCard, {
      props: { defaultView },
      global: { stubs },
      slots: {
        login: '<div data-testid="login-slot">login form</div>',
        register: '<div data-testid="register-slot">register form</div>',
      },
    });
  }

  it('renders the card wrapper', () => {
    const wrapper = mountAuthCard();
    expect(wrapper.find('[data-testid="auth-card"]').exists()).toBe(true);
  });

  it('defaults to login view with login slot visible', () => {
    const wrapper = mountAuthCard();
    expect(wrapper.find('[data-testid="login-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="register-slot"]').exists()).toBe(false);
  });

  it('shows register view when defaultView is register', () => {
    const wrapper = mountAuthCard('register');
    expect(wrapper.find('[data-testid="register-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-slot"]').exists()).toBe(false);
  });

  it('renders close button that emits close', async () => {
    const wrapper = mountAuthCard();
    const closeBtn = wrapper.find('[data-testid="auth-close"]');
    expect(closeBtn.exists()).toBe(true);
    await closeBtn.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('renders divider text in login view', () => {
    const wrapper = mountAuthCard();
    expect(wrapper.find('[data-testid="auth-divider"]').exists()).toBe(true);
  });

  it('renders business account info in login view', () => {
    const wrapper = mountAuthCard();
    expect(wrapper.find('[data-testid="auth-business-info"]').exists()).toBe(
      true,
    );
  });

  it('renders apply button in login view', () => {
    const wrapper = mountAuthCard();
    expect(wrapper.find('[data-testid="auth-apply-button"]').exists()).toBe(
      true,
    );
  });

  it('switches to register view when apply button clicked', async () => {
    const wrapper = mountAuthCard();
    await wrapper.find('[data-testid="auth-apply-button"]').trigger('click');
    expect(wrapper.find('[data-testid="register-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-slot"]').exists()).toBe(false);
  });

  it('renders back-to-login link in register view', () => {
    const wrapper = mountAuthCard('register');
    expect(wrapper.find('[data-testid="auth-back-to-login"]').exists()).toBe(
      true,
    );
  });

  it('switches back to login when sign-in link clicked', async () => {
    const wrapper = mountAuthCard('register');
    const backLink = wrapper.find('[data-testid="auth-back-to-login"] button');
    await backLink.trigger('click');
    expect(wrapper.find('[data-testid="login-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="register-slot"]').exists()).toBe(false);
  });
});
