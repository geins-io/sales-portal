import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PortalStatCard from '../../../app/components/portal/PortalStatCard.vue';

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

describe('PortalStatCard', () => {
  const defaultProps = {
    icon: 'lucide:shopping-cart',
    count: 17,
    label: 'Orders placed',
    subtitle: 'Last 30 days',
  };

  const stubs = { Icon: iconStub, NuxtIcon: iconStub };

  it('renders count', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: defaultProps,
      global: { stubs },
    });
    expect(wrapper.text()).toContain('17');
  });

  it('renders label', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: defaultProps,
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Orders placed');
  });

  it('renders subtitle', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: defaultProps,
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Last 30 days');
  });

  it('shows notification dot when showDot is true', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: { ...defaultProps, showDot: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="stat-card-dot"]').exists()).toBe(true);
  });

  it('hides notification dot by default', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: defaultProps,
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="stat-card-dot"]').exists()).toBe(false);
  });
});
