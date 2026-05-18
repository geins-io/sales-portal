import { describe, it, expect } from 'vitest';
import { ShoppingCart } from 'lucide-vue-next';
import { mountComponent } from '../../utils/component';
import PortalStatCard from '../../../app/components/portal/PortalStatCard.vue';

describe('PortalStatCard', () => {
  const defaultProps = {
    icon: ShoppingCart,
    count: 17,
    label: 'Orders placed',
    subtitle: 'Last 30 days',
  };

  it('renders count', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: defaultProps,
    });
    expect(wrapper.text()).toContain('17');
  });

  it('renders label', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: defaultProps,
    });
    expect(wrapper.text()).toContain('Orders placed');
  });

  it('renders subtitle', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: defaultProps,
    });
    expect(wrapper.text()).toContain('Last 30 days');
  });

  it('shows notification dot when showDot is true', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: { ...defaultProps, showDot: true },
    });
    expect(wrapper.find('[data-testid="stat-card-dot"]').exists()).toBe(true);
  });

  it('hides notification dot by default', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: defaultProps,
    });
    expect(wrapper.find('[data-testid="stat-card-dot"]').exists()).toBe(false);
  });
});
