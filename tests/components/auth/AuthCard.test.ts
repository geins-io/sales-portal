import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import AuthCard from '../../../app/components/auth/AuthCard.vue';

// useTenant mock — default: registration enabled
const mockFeatures = ref<Record<string, { enabled: boolean }>>({
  registration: { enabled: true },
});
vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({ features: mockFeatures }),
}));

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
  beforeEach(() => {
    // Reset to registration enabled before each test
    mockFeatures.value = { registration: { enabled: true } };
  });

  function mountAuthCard(defaultView?: 'login' | 'register' | 'forgot') {
    return shallowMountComponent(AuthCard, {
      props: { defaultView },
      global: { stubs },
      slots: {
        login: '<div data-testid="login-slot">login form</div>',
        register: '<div data-testid="register-slot">register form</div>',
        forgot: '<div data-testid="forgot-slot">forgot form</div>',
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

  it('shows forgot view when defaultView is forgot', () => {
    const wrapper = mountAuthCard('forgot');
    expect(wrapper.find('[data-testid="forgot-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-slot"]').exists()).toBe(false);
  });

  it('renders back-to-login link in forgot view', () => {
    const wrapper = mountAuthCard('forgot');
    expect(
      wrapper.find('[data-testid="auth-forgot-back-to-login"]').exists(),
    ).toBe(true);
  });

  it('switches from forgot back to login', async () => {
    const wrapper = mountAuthCard('forgot');
    const backLink = wrapper.find(
      '[data-testid="auth-forgot-back-to-login"] button',
    );
    await backLink.trigger('click');
    expect(wrapper.find('[data-testid="login-slot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="forgot-slot"]').exists()).toBe(false);
  });

  describe('registration feature flag', () => {
    it('shows divider, business-info, and apply button when registration enabled', () => {
      mockFeatures.value = { registration: { enabled: true } };
      const wrapper = mountAuthCard();
      expect(wrapper.find('[data-testid="auth-divider"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="auth-business-info"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="auth-apply-button"]').exists()).toBe(
        true,
      );
    });

    it('hides divider, business-info, and apply button when registration disabled', () => {
      mockFeatures.value = { registration: { enabled: false } };
      const wrapper = mountAuthCard();
      expect(wrapper.find('[data-testid="auth-divider"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="auth-business-info"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="auth-apply-button"]').exists()).toBe(
        false,
      );
    });

    it('shows affordances (fail-open) when registration key is absent from features', () => {
      mockFeatures.value = {};
      const wrapper = mountAuthCard();
      expect(wrapper.find('[data-testid="auth-divider"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="auth-business-info"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="auth-apply-button"]').exists()).toBe(
        true,
      );
    });

    it('shows affordances (fail-open) when features is undefined', () => {
      // Simulate no tenant config loaded yet
      mockFeatures.value = undefined as unknown as Record<
        string,
        { enabled: boolean }
      >;
      const wrapper = mountAuthCard();
      expect(wrapper.find('[data-testid="auth-divider"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="auth-business-info"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="auth-apply-button"]').exists()).toBe(
        true,
      );
    });

    it('forces login view when defaultView=register but registration disabled', async () => {
      mockFeatures.value = { registration: { enabled: false } };
      const wrapper = mountAuthCard('register');
      await wrapper.vm.$nextTick();
      // Should have been forced to login
      expect(wrapper.find('[data-testid="login-slot"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="register-slot"]').exists()).toBe(
        false,
      );
    });
  });
});
