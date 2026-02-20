import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import CmsWidgetArea from '../../../app/components/cms/CmsWidgetArea.vue';

const stubs = {
  CmsContainer: {
    template: '<div class="cms-container" />',
    props: ['container'],
  },
};

describe('CmsWidgetArea', () => {
  const containers = [
    {
      id: '1',
      name: 'c1',
      sortOrder: 0,
      layout: 'full',
      responsiveMode: '',
      design: '',
      content: [],
    },
    {
      id: '2',
      name: 'c2',
      sortOrder: 1,
      layout: 'half',
      responsiveMode: '',
      design: '',
      content: [],
    },
  ];

  it('renders a CmsContainer for each container', () => {
    const wrapper = shallowMountComponent(CmsWidgetArea, {
      props: { containers },
      global: { stubs },
    });
    expect(wrapper.findAll('.cms-container')).toHaveLength(2);
  });

  it('renders nothing when containers is empty', () => {
    const wrapper = shallowMountComponent(CmsWidgetArea, {
      props: { containers: [] },
      global: { stubs },
    });
    expect(wrapper.findAll('.cms-container')).toHaveLength(0);
  });

  it('wraps containers in a cms-widget-area div', () => {
    const wrapper = shallowMountComponent(CmsWidgetArea, {
      props: { containers },
      global: { stubs },
    });
    expect(wrapper.find('.cms-widget-area').exists()).toBe(true);
  });
});
