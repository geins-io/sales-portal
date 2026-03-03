import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PortalPlaceholder from '../../../app/components/portal/PortalPlaceholder.vue';

const iconStub = {
  template: '<span class="icon" />',
};
const stubs = { Icon: iconStub, NuxtIcon: iconStub };

describe('PortalPlaceholder', () => {
  it('renders the placeholder title', () => {
    const wrapper = mountComponent(PortalPlaceholder, { global: { stubs } });
    expect(wrapper.text()).toContain('portal.placeholder.title');
  });

  it('renders the placeholder description', () => {
    const wrapper = mountComponent(PortalPlaceholder, { global: { stubs } });
    expect(wrapper.text()).toContain('portal.placeholder.description');
  });

  it('has data-testid', () => {
    const wrapper = mountComponent(PortalPlaceholder, { global: { stubs } });
    expect(wrapper.find('[data-testid="portal-placeholder"]').exists()).toBe(
      true,
    );
  });
});
