import { describe, it, expect } from 'vitest';
import { shallowMountComponent, mountComponent } from '../../utils/component';
import LayoutFooterTop from '../../../app/components/layout/footer/LayoutFooterTop.vue';
import LayoutFooterMain from '../../../app/components/layout/footer/LayoutFooterMain.vue';
import LayoutFooterBottom from '../../../app/components/layout/footer/LayoutFooterBottom.vue';

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
  it('renders 5 link columns', () => {
    const wrapper = mountComponent(LayoutFooterMain);
    const headings = wrapper.findAll('h3');
    expect(headings.length).toBe(5);
  });

  it('renders column titles', () => {
    const wrapper = mountComponent(LayoutFooterMain);
    const text = wrapper.text();
    expect(text).toContain('layout.company');
    expect(text).toContain('layout.resources');
  });
});

describe('LayoutFooterBottom', () => {
  it('renders copyright component', () => {
    const wrapper = shallowMountComponent(LayoutFooterBottom);
    expect(wrapper.find('copyright-stub').exists()).toBe(true);
  });

  it('renders legal links', () => {
    const wrapper = mountComponent(LayoutFooterBottom);
    expect(wrapper.text()).toContain('layout.privacy_policy');
    expect(wrapper.text()).toContain('layout.terms_of_service');
  });
});
