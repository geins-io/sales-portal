import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import VideoWidget from '../../../app/components/cms/widgets/VideoWidget.vue';

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      name: 'test-video',
      active: true,
      videoId: 'dQw4w9WgXcQ',
      videoProvider: 0,
      ...overrides,
    },
    config: {
      name: 'test',
      displayName: 'Test Video',
      active: true,
      type: 'VideoPageWidget',
      size: 'full',
      sortOrder: 0,
    },
    layout: 'full',
  };
}

describe('VideoWidget', () => {
  it('renders YouTube iframe with correct embed URL', () => {
    const wrapper = mountComponent(VideoWidget, {
      props: makeProps(),
    });
    const iframe = wrapper.find('iframe');
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes('src')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('renders Vimeo iframe with correct embed URL', () => {
    const wrapper = mountComponent(VideoWidget, {
      props: makeProps({ videoId: '123456789', videoProvider: 1 }),
    });
    const iframe = wrapper.find('iframe');
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes('src')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
  });

  it('does not render iframe when videoId is empty', () => {
    const wrapper = mountComponent(VideoWidget, {
      props: makeProps({ videoId: '' }),
    });
    expect(wrapper.find('iframe').exists()).toBe(false);
  });

  it('has data-testid="cms-widget"', () => {
    const wrapper = mountComponent(VideoWidget, {
      props: makeProps(),
    });
    expect(wrapper.find('[data-testid="cms-widget"]').exists()).toBe(true);
  });

  it('defaults to YouTube when videoProvider is undefined', () => {
    const wrapper = mountComponent(VideoWidget, {
      props: makeProps({ videoProvider: undefined }),
    });
    const iframe = wrapper.find('iframe');
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes('src')).toContain('youtube.com/embed/');
  });
});
