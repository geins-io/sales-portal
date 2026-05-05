import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MenuType } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import LayoutFooterMain from '../../../app/components/layout/footer/LayoutFooterMain.vue';

const mockFooterMenu = ref<MenuType | null>(null);
const mockContact = ref<PublicTenantConfig['contact']>(null);

vi.mock('../../../app/composables/useCmsMenuData', () => ({
  useCmsMenuData: () => ({
    menu: mockFooterMenu,
    pending: ref(false),
    error: ref(null),
    isConfigured: ref(true),
  }),
}));

vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({ contact: mockContact }),
}));

vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

function mount() {
  return mountComponent(LayoutFooterMain);
}

describe('LayoutFooterMain social row', () => {
  beforeEach(() => {
    mockFooterMenu.value = null;
    mockContact.value = null;
  });

  it('does not render social row when contact.social is null', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: null,
      social: null,
    };
    const wrapper = mount();
    expect(wrapper.find('[data-slot="footer-social"]').exists()).toBe(false);
  });

  it('does not render social row when all social URLs are null', () => {
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

  it('renders social row when at least one social URL is set', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: null,
      social: {
        facebook: 'https://facebook.com/example',
        instagram: null,
        twitter: null,
        linkedin: null,
        youtube: null,
      },
    };
    const wrapper = mount();
    const row = wrapper.find('[data-slot="footer-social"]');
    expect(row.exists()).toBe(true);
    const anchors = row.findAll('a');
    expect(anchors).toHaveLength(1);
    expect(anchors[0].attributes('href')).toBe('https://facebook.com/example');
  });

  it('renders only configured social entries with correct lucide icons', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: null,
      social: {
        facebook: 'https://facebook.com/x',
        instagram: null,
        twitter: 'https://twitter.com/x',
        linkedin: null,
        youtube: null,
      },
    };
    const wrapper = mount();
    const anchors = wrapper.find('[data-slot="footer-social"]').findAll('a');
    expect(anchors).toHaveLength(2);
    const iconNames = anchors.map((a) =>
      a.find('[data-name]').attributes('data-name'),
    );
    expect(iconNames).toContain('lucide:facebook');
    expect(iconNames).toContain('lucide:twitter');
  });

  it('sets target="_blank" and rel="noopener noreferrer" on each anchor', () => {
    mockContact.value = {
      email: null,
      phone: null,
      address: null,
      social: {
        facebook: 'https://facebook.com/x',
        instagram: 'https://instagram.com/x',
        twitter: null,
        linkedin: null,
        youtube: null,
      },
    };
    const wrapper = mount();
    const anchors = wrapper.find('[data-slot="footer-social"]').findAll('a');
    expect(anchors).toHaveLength(2);
    for (const a of anchors) {
      expect(a.attributes('target')).toBe('_blank');
      expect(a.attributes('rel')).toBe('noopener noreferrer');
    }
  });
});
