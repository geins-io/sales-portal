import { ref } from 'vue';
import { describe, it, expect, vi } from 'vitest';
import type { MenuType } from '@geins/types';
import { shallowMountComponent, mountComponent } from '../../utils/component';
import LayoutFooter from '../../../app/components/layout/LayoutFooter.vue';
import LayoutFooterTop from '../../../app/components/layout/footer/LayoutFooterTop.vue';
import LayoutFooterMain from '../../../app/components/layout/footer/LayoutFooterMain.vue';
import LayoutFooterBottom from '../../../app/components/layout/footer/LayoutFooterBottom.vue';

const mockFooterMenu = ref<MenuType | null>(null);
// LayoutFooterMain migrated to useCmsMenuData (tenant-config-keyed menu
// resolver). We mock that instead of the older useMenuData.
vi.mock('~/composables/useCmsMenuData', () => ({
  useCmsMenuData: () => ({
    menu: mockFooterMenu,
    pending: ref(false),
    error: ref(null),
    isConfigured: ref(true),
  }),
}));
vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

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
});

describe('LayoutFooterMain', () => {
  it('renders nothing when menu is null', () => {
    mockFooterMenu.value = null;
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(false);
  });

  it('renders nothing when menu has no items', () => {
    mockFooterMenu.value = { id: '1', title: 'Footer', menuItems: [] };
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.find('[data-slot="footer-main"]').exists()).toBe(false);
  });

  it('renders CMS footer menu items as links', () => {
    mockFooterMenu.value = {
      id: '1',
      title: 'Footer',
      menuItems: [
        { id: '1', label: 'About us', canonicalUrl: '/about-us', order: 1 },
        { id: '2', label: 'Contact', canonicalUrl: '/contact', order: 2 },
      ],
    };
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.text()).toContain('About us');
    expect(wrapper.text()).toContain('Contact');
  });

  it('renders menu title as heading when present', () => {
    mockFooterMenu.value = {
      id: '1',
      title: 'Footer Links',
      menuItems: [
        { id: '1', label: 'About', canonicalUrl: '/about', order: 1 },
      ],
    };
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.text()).toContain('Footer Links');
  });

  it('renders children as sub-group when parent has children', () => {
    mockFooterMenu.value = {
      id: '1',
      title: 'Footer',
      menuItems: [
        {
          id: '1',
          label: 'Company',
          order: 1,
          children: [
            { id: '1-1', label: 'About us', canonicalUrl: '/about', order: 1 },
            { id: '1-2', label: 'Careers', canonicalUrl: '/careers', order: 2 },
          ],
        },
      ],
    };
    const wrapper = shallowMountComponent(LayoutFooterMain);
    expect(wrapper.text()).toContain('Company');
    expect(wrapper.text()).toContain('About us');
    expect(wrapper.text()).toContain('Careers');
  });

  it('filters hidden items', () => {
    mockFooterMenu.value = {
      id: '1',
      title: 'Footer',
      menuItems: [
        { id: '1', label: 'Visible', order: 1 },
        { id: '2', label: 'Hidden', hidden: true, order: 2 },
      ],
    };
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
