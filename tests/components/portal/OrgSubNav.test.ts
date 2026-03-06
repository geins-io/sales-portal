import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import OrgSubNav from '../../../app/components/portal/org/OrgSubNav.vue';

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const stubs = { Icon: iconStub, NuxtIcon: iconStub };

describe('OrgSubNav', () => {
  it('renders all 3 tabs', () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { activeTab: 'info' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-tab-info"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="org-tab-addresses"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="org-tab-buyers"]').exists()).toBe(true);
  });

  it('renders tab labels', () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { activeTab: 'info' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('portal.org.tabs.info');
    expect(wrapper.text()).toContain('portal.org.tabs.addresses');
    expect(wrapper.text()).toContain('portal.org.tabs.buyers');
  });

  it('applies active styling to the active tab', () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { activeTab: 'addresses' },
      global: { stubs },
    });
    const activeTab = wrapper.find('[data-testid="org-tab-addresses"]');
    const inactiveTab = wrapper.find('[data-testid="org-tab-info"]');
    expect(activeTab.classes()).toContain('border-primary');
    expect(activeTab.classes()).toContain('text-foreground');
    expect(inactiveTab.classes()).toContain('border-transparent');
    expect(inactiveTab.classes()).toContain('text-muted-foreground');
  });

  it('emits update:tab when a tab is clicked', async () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { activeTab: 'info' },
      global: { stubs },
    });
    await wrapper.find('[data-testid="org-tab-buyers"]').trigger('click');
    expect(wrapper.emitted('update:tab')).toBeTruthy();
    expect(wrapper.emitted('update:tab')![0]).toEqual(['buyers']);
  });

  it('renders nav element with data-testid', () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { activeTab: 'info' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-sub-nav"]').exists()).toBe(true);
  });
});
