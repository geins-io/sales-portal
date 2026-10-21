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

  it('renders the count as a link to the given view when `to` is set', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: { ...defaultProps, to: '/se/sv/portal/orders' },
    });
    const link = wrapper.find('a[data-testid="stat-card-count"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/se/sv/portal/orders');
    expect(link.text()).toContain('17');
  });

  it('renders the count as plain text when `to` is omitted', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: defaultProps,
    });
    expect(wrapper.find('a[data-testid="stat-card-count"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('p[data-testid="stat-card-count"]').exists()).toBe(
      true,
    );
  });

  it('renders a dash instead of a number when the count is unknown', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: { ...defaultProps, count: undefined },
    });
    expect(wrapper.find('[data-testid="stat-card-count"]').text()).toBe('—');
  });

  it('renders a dash in the link when the count is unknown and `to` is set', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: { ...defaultProps, count: undefined, to: '/se/sv/portal/orders' },
    });
    expect(wrapper.find('a[data-testid="stat-card-count"]').text()).toBe('—');
  });

  it('renders a zero count as 0', () => {
    const wrapper = mountComponent(PortalStatCard, {
      props: { ...defaultProps, count: 0 },
    });
    expect(wrapper.find('[data-testid="stat-card-count"]').text()).toBe('0');
  });
});
