import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import OrgInfoCard from '../../../app/components/portal/org/OrgInfoCard.vue';
import type { Organization } from '#shared/types/b2b';

const iconStub = {
  template: '<span class="icon" :data-name="name"></span>',
  props: ['name'],
};

const stubs = {
  Icon: iconStub,
  NuxtIcon: iconStub,
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
    inheritAttrs: false,
  },
  Input: {
    template:
      '<input :data-testid="$attrs[\'data-testid\']" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue'],
    inheritAttrs: false,
  },
  Label: {
    template: '<label><slot /></label>',
  },
};

const mockOrg: Organization = {
  id: 'org-1',
  name: 'Acme Corp',
  organizationNumber: '556677-8899',
  status: 'active',
  referenceContact: 'Jane Doe',
  email: 'info@acme.com',
  phone: '+46701234567',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
};

describe('OrgInfoCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders org info card', () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-info-card"]').exists()).toBe(true);
  });

  it('renders organization name', () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-name"]').text()).toBe('Acme Corp');
  });

  it('renders organization number', () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-organizationNumber"]').text()).toBe(
      '556677-8899',
    );
  });

  it('renders email and phone', () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-email"]').text()).toBe(
      'info@acme.com',
    );
    expect(wrapper.find('[data-testid="org-phone"]').text()).toBe(
      '+46701234567',
    );
  });

  it('renders status badge', () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: false },
      global: { stubs },
    });
    const badge = wrapper.find('[data-testid="org-status-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toContain('portal.org.status.active');
  });

  it('shows edit button when canEdit is true', () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-edit-btn"]').exists()).toBe(true);
  });

  it('hides edit button when canEdit is false', () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: false },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-edit-btn"]').exists()).toBe(false);
  });

  it('shows edit form when edit button is clicked', async () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: true },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="org-info-form"]').exists()).toBe(false);
    await wrapper.find('[data-testid="org-edit-btn"]').trigger('click');
    expect(wrapper.find('[data-testid="org-info-form"]').exists()).toBe(true);
  });

  it('hides edit button while editing', async () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: true },
      global: { stubs },
    });
    await wrapper.find('[data-testid="org-edit-btn"]').trigger('click');
    expect(wrapper.find('[data-testid="org-edit-btn"]').exists()).toBe(false);
  });

  it('cancels editing and restores original values', async () => {
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: mockOrg, canEdit: true },
      global: { stubs },
    });
    await wrapper.find('[data-testid="org-edit-btn"]').trigger('click');
    await wrapper.find('[data-testid="org-info-cancel"]').trigger('click');
    expect(wrapper.find('[data-testid="org-info-form"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="org-name"]').text()).toBe('Acme Corp');
  });

  it('renders status variant for suspended org', () => {
    const suspended = { ...mockOrg, status: 'suspended' as const };
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: suspended, canEdit: false },
      global: { stubs },
    });
    const badge = wrapper.find('[data-testid="org-status-badge"]');
    expect(badge.classes()).toContain('bg-red-100');
    expect(badge.classes()).toContain('text-red-800');
  });

  it('renders status variant for pending org', () => {
    const pending = { ...mockOrg, status: 'pending' as const };
    const wrapper = mountComponent(OrgInfoCard, {
      props: { organization: pending, canEdit: false },
      global: { stubs },
    });
    const badge = wrapper.find('[data-testid="org-status-badge"]');
    expect(badge.classes()).toContain('bg-yellow-100');
    expect(badge.classes()).toContain('text-yellow-800');
  });
});
