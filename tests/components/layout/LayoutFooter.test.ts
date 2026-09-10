import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import type { AuthUser, MenuType } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { shallowMountComponent, mountComponent } from '../../utils/component';
import { useTenant } from '../../../app/composables/useTenant';
import { useAuthStore } from '../../../app/stores/auth';
import LayoutFooter from '../../../app/components/layout/LayoutFooter.vue';
import LayoutFooterTop from '../../../app/components/layout/footer/LayoutFooterTop.vue';
import LayoutFooterMain from '../../../app/components/layout/footer/LayoutFooterMain.vue';
import LayoutFooterBottom from '../../../app/components/layout/footer/LayoutFooterBottom.vue';

// Key-aware mock: each footer key gets its own ref so the three explicit
// useCmsMenuData calls in LayoutFooterMain resolve independently.
const footerMenus: Record<string, ReturnType<typeof ref<MenuType | null>>> = {
  footer: ref<MenuType | null>(null),
  footer_2: ref<MenuType | null>(null),
  footer_3: ref<MenuType | null>(null),
};

vi.mock('~/composables/useCmsMenuData', () => ({
  useCmsMenuData: (key: string) => ({
    menu: footerMenus[key] ?? ref(null),
    pending: ref(false),
    error: ref(null),
    isConfigured: ref(true),
  }),
}));
vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. The real chain then runs over the fixture below.
vi.unmock('../../../app/composables/useFeatureAccess');

// `isAuthenticated` is `!!user.value`, so identity is all this needs to carry.
const SIGNED_IN: AuthUser = {
  userId: '1',
  username: 'buyer@example.com',
};

const { tenant } = useTenant();

function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

// File level, not inside a describe: both of these live for the whole file, so
// a reset scoped to one block would leave the last test's signed-in user and
// access rule in place for every sibling block after it.
beforeEach(() => {
  setFeatures({});
  // Sign out: the Pinia store is shared across this file's tests.
  useAuthStore().user = null;
});

describe('LayoutFooter root', () => {
  it('paints bg-footer-background on the outer footer (unified background)', () => {
    const wrapper = shallowMountComponent(LayoutFooter);
    const footer = wrapper.find('footer');
    expect(footer.exists()).toBe(true);
    expect(footer.classes()).toContain('bg-footer-background');
    expect(footer.classes()).not.toContain('bg-neutral-900');
    expect(footer.classes()).toContain('text-footer-text');
  });

  it('keeps the border-t separator class on the outer footer', () => {
    const wrapper = shallowMountComponent(LayoutFooter);
    const footer = wrapper.find('footer');
    expect(footer.classes()).toContain('border-t');
  });
});

// One test per configured value of `newsletterSignup`, each writing the value
// itself rather than a decision derived from it. Registered in
// tests/unit/config-coverage/map.ts, which requires the key in the title.
//
// The gate is `v-if="showNewsletter"` on LayoutFooterTop, so under a shallow
// mount the assertion is whether the child's stub is in the tree at all.
describe('newsletterSignup', () => {
  const TOP = 'layout-footer-top-stub';

  function mountFooter() {
    return shallowMountComponent(LayoutFooter);
  }

  it('shows the newsletter when newsletterSignup is absent from features', () => {
    expect(mountFooter().find(TOP).exists()).toBe(true);
  });

  it('shows the newsletter when newsletterSignup is enabled with no access rule', () => {
    setFeatures({ newsletterSignup: { enabled: true } });
    expect(mountFooter().find(TOP).exists()).toBe(true);
  });

  it('hides the newsletter when newsletterSignup is disabled', () => {
    setFeatures({ newsletterSignup: { enabled: false } });
    expect(mountFooter().find(TOP).exists()).toBe(false);
  });

  it('shows the newsletter when newsletterSignup access is open to all', () => {
    setFeatures({ newsletterSignup: { enabled: true, access: 'all' } });
    expect(mountFooter().find(TOP).exists()).toBe(true);
  });

  it('hides the newsletter when newsletterSignup requires authentication and the user is anonymous', () => {
    setFeatures({
      newsletterSignup: { enabled: true, access: 'authenticated' },
    });
    expect(mountFooter().find(TOP).exists()).toBe(false);
  });

  it('shows the newsletter when newsletterSignup requires authentication and the user is signed in', () => {
    setFeatures({
      newsletterSignup: { enabled: true, access: 'authenticated' },
    });
    useAuthStore().user = SIGNED_IN;
    expect(mountFooter().find(TOP).exists()).toBe(true);
  });
});

describe('LayoutFooterTop', () => {
  it('renders newsletter section', () => {
    const wrapper = mountComponent(LayoutFooterTop);
    expect(wrapper.text()).toContain('layout.subscribe_heading');
  });

  it('renders email input and subscribe button', () => {
    const wrapper = mountComponent(LayoutFooterTop);
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('layout.subscribe');
  });

  it('pins the email input to a white background in both color schemes', () => {
    const wrapper = mountComponent(LayoutFooterTop);
    const input = wrapper.find('input[type="email"]');
    const classes = input.classes();
    // Literal white, not a theme token: the input must read white regardless
    // of tenant theme. Light-scheme background.
    expect(classes).toContain('bg-white');
    // Dark scheme: the base Input ships dark:bg-input/30, which otherwise wins
    // under prefers-color-scheme: dark and renders the input translucent grey.
    // dark:bg-white must override it so the field stays white.
    expect(classes).toContain('dark:bg-white');
    expect(classes).not.toContain('dark:bg-input/30');
    expect(classes).not.toContain('bg-transparent');
  });
});

describe('LayoutFooterMain', () => {
  it('renders nothing when menu is null', () => {
    footerMenus.footer!.value = null;
    footerMenus.footer_2!.value = null;
    footerMenus.footer_3!.value = null;
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(false);
  });

  it('renders nothing when menu has no items', () => {
    footerMenus.footer!.value = { id: '1', title: 'Footer', menuItems: [] };
    footerMenus.footer_2!.value = null;
    footerMenus.footer_3!.value = null;
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(false);
  });

  it('renders CMS footer menu items as flat links', () => {
    footerMenus.footer!.value = {
      id: '1',
      title: 'Footer',
      menuItems: [
        { id: '1', label: 'About us', canonicalUrl: '/about-us', order: 1 },
        { id: '2', label: 'Contact', canonicalUrl: '/contact', order: 2 },
      ],
    };
    footerMenus.footer_2!.value = null;
    footerMenus.footer_3!.value = null;
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.text()).toContain('About us');
    expect(wrapper.text()).toContain('Contact');
  });

  it('renders menu title as heading when present', () => {
    footerMenus.footer!.value = {
      id: '1',
      title: 'Footer Links',
      menuItems: [
        { id: '1', label: 'About', canonicalUrl: '/about', order: 1 },
      ],
    };
    footerMenus.footer_2!.value = null;
    footerMenus.footer_3!.value = null;
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.text()).toContain('Footer Links');
  });

  it('filters hidden items', () => {
    footerMenus.footer!.value = {
      id: '1',
      title: 'Footer',
      menuItems: [
        { id: '1', label: 'Visible', order: 1 },
        { id: '2', label: 'Hidden', hidden: true, order: 2 },
      ],
    };
    footerMenus.footer_2!.value = null;
    footerMenus.footer_3!.value = null;
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.text()).toContain('Visible');
    expect(wrapper.text()).not.toContain('Hidden');
  });
});

describe('LayoutFooterBottom', () => {
  it('renders copyright component', () => {
    const wrapper = shallowMountComponent(LayoutFooterBottom);
    expect(wrapper.find('copyright-stub').exists()).toBe(true);
  });

  it('does not render hardcoded legal links (moved to CMS menu)', () => {
    const wrapper = mountComponent(LayoutFooterBottom);
    expect(wrapper.text()).not.toContain('layout.privacy_policy');
    expect(wrapper.text()).not.toContain('layout.terms_of_service');
  });
});
