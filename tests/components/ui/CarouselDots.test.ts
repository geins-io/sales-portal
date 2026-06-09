import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { mountComponent } from '../../utils/component';
import CarouselDots from '../../../app/components/ui/carousel/CarouselDots.vue';

const mockScrollTo = vi.fn();
const mockScrollSnaps = ref<number[]>([0, 0.5]);
const mockSelectedIndex = ref(0);

vi.mock('../../../app/components/ui/carousel/useCarousel', () => ({
  useCarousel: () => ({
    scrollSnaps: mockScrollSnaps,
    selectedIndex: mockSelectedIndex,
    scrollTo: mockScrollTo,
  }),
}));

describe('CarouselDots', () => {
  beforeEach(() => {
    mockScrollSnaps.value = [0, 0.5];
    mockSelectedIndex.value = 0;
    mockScrollTo.mockClear();
  });

  it('renders one dot button per scrollSnaps entry', () => {
    const wrapper = mountComponent(CarouselDots);
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(mockScrollSnaps.value.length);
  });

  it('renders nothing when scrollSnaps is empty', () => {
    mockScrollSnaps.value = [];
    const wrapper = mountComponent(CarouselDots);
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('marks the dot at selectedIndex as active via aria-selected', () => {
    mockSelectedIndex.value = 1;
    const wrapper = mountComponent(CarouselDots);
    const buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('aria-selected')).toBe('false');
    expect(buttons[1].attributes('aria-selected')).toBe('true');
  });

  it('sets data-active on the active dot only', () => {
    mockSelectedIndex.value = 0;
    const wrapper = mountComponent(CarouselDots);
    const buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('data-active')).toBe('true');
    expect(buttons[1].attributes('data-active')).toBeUndefined();
  });

  it('calls scrollTo with the correct index when a dot is clicked', async () => {
    const wrapper = mountComponent(CarouselDots);
    const buttons = wrapper.findAll('button');
    await buttons[1].trigger('click');
    expect(mockScrollTo).toHaveBeenCalledOnce();
    expect(mockScrollTo).toHaveBeenCalledWith(1);
  });

  it('moves the active marker to the new selectedIndex after nextTick', async () => {
    const wrapper = mountComponent(CarouselDots);
    let buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('aria-selected')).toBe('true');

    mockSelectedIndex.value = 1;
    await nextTick();

    buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('aria-selected')).toBe('false');
    expect(buttons[1].attributes('aria-selected')).toBe('true');
  });
});
