import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import OrgSubNav from '../../../app/components/portal/org/OrgSubNav.vue';

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const buttonStub = {
  template:
    '<button v-bind="$attrs" :class="[$attrs.class]" @click="$emit(\'click\', $event)"><slot /></button>',
  props: ['variant', 'size'],
  emits: ['click'],
};

const stubs = {
  Icon: iconStub,
  NuxtIcon: iconStub,
  Button: buttonStub,
  UiButton: buttonStub,
};

describe('OrgSubNav', () => {
  it('renders all 4 tabs', () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { modelValue: 'info' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-tab-info"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="org-tab-persons"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="org-tab-addresses"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="org-tab-roles"]').exists()).toBe(true);
  });

  it('renders tab labels', () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { modelValue: 'info' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('portal.org.tabs.info');
    expect(wrapper.text()).toContain('portal.org.tabs.persons');
    expect(wrapper.text()).toContain('portal.org.tabs.addresses');
    expect(wrapper.text()).toContain('portal.org.tabs.roles');
  });

  it('applies active styling to the active tab', () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { modelValue: 'addresses' },
      global: { stubs },
    });
    // Desktop nav (hidden on mobile, visible md+)
    const allButtons = wrapper.findAll('[data-testid="org-tab-addresses"]');
    const activeTab = allButtons[0]!;
    const allInfoButtons = wrapper.findAll('[data-testid="org-tab-info"]');
    const inactiveTab = allInfoButtons[0]!;
    expect(activeTab.classes()).toContain('font-medium');
    expect(inactiveTab.classes()).toContain('text-muted-foreground');
  });

  it('emits update:modelValue when a tab is clicked', async () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { modelValue: 'info' },
      global: { stubs },
    });
    const personsButtons = wrapper.findAll('[data-testid="org-tab-persons"]');
    await personsButtons[0]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['persons']);
  });

  it('renders nav element with data-testid', () => {
    const wrapper = mountComponent(OrgSubNav, {
      props: { modelValue: 'info' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-sub-nav"]').exists()).toBe(true);
  });
});
