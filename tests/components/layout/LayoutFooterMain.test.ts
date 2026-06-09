import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MenuType } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import LayoutFooterMain from '../../../app/components/layout/footer/LayoutFooterMain.vue';

// Three independent menu refs, one per footer menu key
const footerMenus = {
  footer: ref<MenuType | null>(null),
  footer_2: ref<MenuType | null>(null),
  footer_3: ref<MenuType | null>(null),
};

vi.mock('../../../app/composables/useCmsMenuData', () => ({
  useCmsMenuData: (key: string) => ({
    menu: footerMenus[key as keyof typeof footerMenus],
    pending: ref(false),
    error: ref(null),
    isConfigured: ref(true),
  }),
}));

const mockContact = ref<PublicTenantConfig['contact']>(null);

vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({ contact: mockContact }),
}));

const mockCurrentLocale = ref('en');
const mockLocalePath = (p: string) => p;

vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentLocale: mockCurrentLocale,
    localePath: mockLocalePath,
  }),
}));

vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

function mount() {
  return mountComponent(LayoutFooterMain);
}

describe('LayoutFooterMain', () => {
  beforeEach(() => {
    footerMenus.footer.value = null;
    footerMenus.footer_2.value = null;
    footerMenus.footer_3.value = null;
    mockContact.value = null;
    mockCurrentLocale.value = 'en';
  });

  // --- shouldRender: outer wrapper ---

  it('renders nothing when all menus null and no contact and no address', () => {
    const wrapper = mount();
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(false);
  });

  it('renders nothing when all menus have empty items and no contact and no address', () => {
    footerMenus.footer.value = { id: '1', title: 'Footer', menuItems: [] };
    footerMenus.footer_2.value = { id: '2', title: 'Footer 2', menuItems: [] };
    footerMenus.footer_3.value = { id: '3', title: 'Footer 3', menuItems: [] };
    const wrapper = mount();
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(false);
  });

  it('renders wrapper when at least one menu has visible items', () => {
    footerMenus.footer.value = {
      id: '1',
      title: 'Links',
      menuItems: [
        { id: 'a', label: 'About', canonicalUrl: '/about', order: 1 },
      ],
    };
    const wrapper = mount();
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(true);
  });

  it('renders wrapper when contact has email even if menus are all null', () => {
    mockContact.value = {
      email: 'test@example.com',
      phone: null,
      address: null,
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(true);
  });

  it('renders wrapper when address is present even if menus and contact are null', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: {
        street: '1 Main St',
        city: null,
        postalCode: null,
        country: null,
      },
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(true);
  });

  // --- Three independent menu columns ---

  it('renders three separate columns when all three menus have visible items', () => {
    footerMenus.footer.value = {
      id: '1',
      title: 'Menu A',
      menuItems: [
        { id: 'a1', label: 'Item A1', canonicalUrl: '/a1', order: 1 },
      ],
    };
    footerMenus.footer_2.value = {
      id: '2',
      title: 'Menu B',
      menuItems: [
        { id: 'b1', label: 'Item B1', canonicalUrl: '/b1', order: 1 },
      ],
    };
    footerMenus.footer_3.value = {
      id: '3',
      title: 'Menu C',
      menuItems: [
        { id: 'c1', label: 'Item C1', canonicalUrl: '/c1', order: 1 },
      ],
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('Item A1');
    expect(wrapper.text()).toContain('Item B1');
    expect(wrapper.text()).toContain('Item C1');
  });

  it('renders only columns with visible items (skips empty menu)', () => {
    footerMenus.footer.value = {
      id: '1',
      title: 'Menu A',
      menuItems: [{ id: 'a1', label: 'Only', canonicalUrl: '/only', order: 1 }],
    };
    footerMenus.footer_2.value = { id: '2', title: 'Empty', menuItems: [] };
    footerMenus.footer_3.value = null;
    const wrapper = mount();
    expect(wrapper.text()).toContain('Only');
    expect(wrapper.text()).not.toContain('Empty');
  });

  // --- Menu column: title heading ---

  it('renders menu title as heading when present', () => {
    footerMenus.footer.value = {
      id: '1',
      title: 'Company',
      menuItems: [
        { id: 'a', label: 'About', canonicalUrl: '/about', order: 1 },
      ],
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('Company');
  });

  it('hides title heading when menu title is empty string', () => {
    footerMenus.footer.value = {
      id: '1',
      title: '',
      menuItems: [
        { id: 'a', label: 'About', canonicalUrl: '/about', order: 1 },
      ],
    };
    const wrapper = mount();
    const headings = wrapper.findAll('h3');
    // None of the h3s should contain an empty text node from the menu title
    const emptyHeading = headings.find((h) => h.text() === '');
    expect(emptyHeading).toBeUndefined();
  });

  // --- Menu column: flat items only (no child expansion) ---

  it('renders flat top-level items only without expanding children', () => {
    footerMenus.footer.value = {
      id: '1',
      title: 'Nav',
      menuItems: [
        {
          id: 'p1',
          label: 'Parent',
          order: 1,
          children: [
            { id: 'c1', label: 'Child Item', canonicalUrl: '/child', order: 1 },
          ],
        },
      ],
    };
    const wrapper = mount();
    // Top-level "Parent" item IS rendered
    expect(wrapper.text()).toContain('Parent');
    // But the nested child is NOT rendered (flat, not nested expansion)
    expect(wrapper.text()).not.toContain('Child Item');
  });

  // --- Menu items: link rendering ---

  it('renders internal menu items as NuxtLink anchors', () => {
    footerMenus.footer.value = {
      id: '1',
      title: 'Links',
      menuItems: [
        { id: 'a', label: 'About', canonicalUrl: '/about', order: 1 },
      ],
    };
    const wrapper = mount();
    const links = wrapper.findAll('a');
    expect(links.some((a) => a.text() === 'About')).toBe(true);
  });

  it('filters hidden items in menu columns', () => {
    footerMenus.footer.value = {
      id: '1',
      title: 'Links',
      menuItems: [
        { id: 'a', label: 'Visible', canonicalUrl: '/visible', order: 1 },
        {
          id: 'b',
          label: 'Hidden Item',
          canonicalUrl: '/hidden',
          hidden: true,
          order: 2,
        },
      ],
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('Visible');
    expect(wrapper.text()).not.toContain('Hidden Item');
  });

  // --- Contact column ---

  it('renders contact column with header, email and phone when both present', () => {
    mockContact.value = {
      email: 'info@example.com',
      phone: '+46 70 123 45 67',
      address: null,
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('layout.contact');
    expect(wrapper.text()).toContain('layout.email');
    expect(wrapper.text()).toContain('layout.phone');
    expect(wrapper.text()).toContain('info@example.com');
    expect(wrapper.text()).toContain('+46 70 123 45 67');
  });

  it('renders contact column when only email present', () => {
    mockContact.value = {
      email: 'hi@example.com',
      phone: null,
      address: null,
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('layout.contact');
    expect(wrapper.text()).toContain('layout.email');
    expect(wrapper.text()).not.toContain('layout.phone');
  });

  it('renders contact column when only phone present', () => {
    mockContact.value = {
      email: null,
      phone: '08-123 456',
      address: null,
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('layout.contact');
    expect(wrapper.text()).toContain('layout.phone');
    expect(wrapper.text()).not.toContain('layout.email');
  });

  it('does not render contact column when both email and phone are null', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: null,
      social: null,
    };
    const wrapper = mount();
    // No footer-main either since no address and no menus
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(false);
  });

  it('contact column absent when contact itself is null', () => {
    mockContact.value = null;
    footerMenus.footer.value = {
      id: '1',
      title: 'Nav',
      menuItems: [{ id: 'a', label: 'Home', canonicalUrl: '/', order: 1 }],
    };
    const wrapper = mount();
    expect(wrapper.text()).not.toContain('layout.contact');
  });

  it('email link uses mailto: href', () => {
    mockContact.value = {
      email: 'shop@test.com',
      phone: null,
      address: null,
      social: null,
    };
    const wrapper = mount();
    const links = wrapper.findAll('a');
    const emailLink = links.find(
      (a) => a.attributes('href') === 'mailto:shop@test.com',
    );
    expect(emailLink).toBeTruthy();
  });

  it('tel href strips spaces while display text keeps formatting', () => {
    mockContact.value = {
      email: null,
      phone: '+46 70 123 45 67',
      address: null,
      social: null,
    };
    const wrapper = mount();
    const links = wrapper.findAll('a');
    const telLink = links.find(
      (a) => a.attributes('href') === 'tel:+46701234567',
    );
    expect(telLink).toBeTruthy();
    expect(telLink!.text()).toBe('+46 70 123 45 67');
  });

  it('contact labels use i18n keys (layout.email / layout.phone), not hardcoded English', () => {
    mockContact.value = {
      email: 'a@b.com',
      phone: '08-555 555',
      address: null,
      social: null,
    };
    const wrapper = mount();
    const html = wrapper.html();
    // $t mock returns keys as-is; should see the key strings, NOT hardcoded English
    expect(html).toContain('layout.email');
    expect(html).toContain('layout.phone');
    expect(html).not.toContain('>Email<');
    expect(html).not.toContain('>Phone<');
  });

  // --- Address column ---

  it('renders address column when address has a street', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: {
        street: 'Main Street 1',
        city: 'Stockholm',
        postalCode: '11122',
        country: 'SE',
      },
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('layout.address');
    expect(wrapper.text()).toContain('Main Street 1');
    expect(wrapper.text()).toContain('11122 Stockholm');
  });

  it('does not render address column when address is null', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: null,
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.text()).not.toContain('layout.address');
  });

  it('does not render address column when address is all-empty fields', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: { street: null, city: null, postalCode: null, country: null },
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.text()).not.toContain('layout.address');
  });

  it('renders country as region name (SE -> Sweden for en locale)', () => {
    mockCurrentLocale.value = 'en';
    mockContact.value = {
      email: null,
      phone: null,
      address: { street: null, city: null, postalCode: null, country: 'SE' },
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('Sweden');
  });

  it('renders country as region name in sv locale (SE -> Sverige)', () => {
    mockCurrentLocale.value = 'sv';
    mockContact.value = {
      email: null,
      phone: null,
      address: { street: null, city: null, postalCode: null, country: 'SE' },
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('Sverige');
  });

  it('falls back to raw country code when Intl throws or returns undefined', () => {
    mockContact.value = {
      email: null,
      phone: null,
      // Use a code that causes Intl to throw (non-2-letter code triggers RangeError)
      address: {
        street: null,
        city: null,
        postalCode: null,
        country: 'INVALID_CODE',
      },
      social: null,
    };
    const wrapper = mount();
    // When Intl throws, the raw code is rendered rather than nothing
    expect(wrapper.text()).toContain('INVALID_CODE');
  });

  it('omits country line when country is null', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: {
        street: '5 Elm',
        city: 'Gothenburg',
        postalCode: '41256',
        country: null,
      },
      social: null,
    };
    const wrapper = mount();
    // Should not have an empty <p> for country
    const paras = wrapper.findAll('p');
    expect(paras.every((p) => p.text().trim() !== '')).toBe(true);
  });

  it('cityLine omits blank postalCode and city gracefully', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: { street: null, city: 'Malmo', postalCode: null, country: null },
      social: null,
    };
    const wrapper = mount();
    // cityLine = 'Malmo' (no leading space or separator)
    expect(wrapper.text()).toContain('Malmo');
    expect(wrapper.text()).not.toMatch(/^\s+Malmo/);
  });

  it('renders only city when postalCode is null (no stray space)', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: {
        street: null,
        city: 'Uppsala',
        postalCode: null,
        country: null,
      },
      social: null,
    };
    const wrapper = mount();
    const paras = wrapper.findAll('p');
    const cityPara = paras.find((p) => p.text() === 'Uppsala');
    expect(cityPara).toBeTruthy();
  });

  it('renders combined postalCode city when both present', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: {
        street: null,
        city: 'Lund',
        postalCode: '22100',
        country: null,
      },
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.text()).toContain('22100 Lund');
  });

  // --- Social row removed ---

  it('does not render footer-social slot for any social input', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: null,
      social: {
        facebook: 'https://facebook.com/example',
        instagram: 'https://instagram.com/example',
        twitter: null,
        linkedin: null,
        youtube: null,
      },
    };
    const wrapper = mount();
    expect(wrapper.find('[data-slot="footer-social"]').exists()).toBe(false);
  });

  it('does not render footer-social slot when all social URLs are null', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: null,
      social: {
        facebook: null,
        instagram: null,
        twitter: null,
        linkedin: null,
        youtube: null,
      },
    };
    const wrapper = mount();
    expect(wrapper.find('[data-slot="footer-social"]').exists()).toBe(false);
  });

  // --- mx-auto max-w-7xl container preserved ---

  it('contains mx-auto max-w-7xl inner container when rendering', () => {
    footerMenus.footer.value = {
      id: '1',
      title: 'Nav',
      menuItems: [{ id: 'a', label: 'Home', canonicalUrl: '/', order: 1 }],
    };
    const wrapper = mount();
    expect(wrapper.find('.mx-auto.max-w-7xl').exists()).toBe(true);
  });
});
