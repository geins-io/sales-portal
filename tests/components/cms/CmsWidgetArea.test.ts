import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import CmsWidgetArea from '../../../app/components/cms/CmsWidgetArea.vue';

const stubs = {
  CmsContainer: {
    template: '<div class="cms-container" />',
    props: ['container'],
  },
  // Render the boundary's default slot so the container still shows; the real
  // boundary's resilience (degrade-on-error) is covered in ErrorBoundary.test.
  ErrorBoundary: {
    template: '<div class="eb-wrap"><slot /></div>',
    props: ['section', 'silent'],
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

  it('wraps each container in its own error boundary', () => {
    // Per-container boundaries are what keep one failing widget from blanking
    // the whole area; assert the wiring is one boundary per container.
    const wrapper = shallowMountComponent(CmsWidgetArea, {
      props: { containers },
      global: { stubs },
    });
    expect(wrapper.findAll('.eb-wrap')).toHaveLength(2);
    // And each boundary holds a container.
    expect(wrapper.findAll('.eb-wrap .cms-container')).toHaveLength(2);
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
