import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
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

  it('marks the dot at selectedIndex as active via aria-current', () => {
    mockSelectedIndex.value = 1;
    const wrapper = mountComponent(CarouselDots);
    const [firstDot, secondDot] = wrapper.findAll('button');
    assert.isDefined(firstDot);
    assert.isDefined(secondDot);
    expect(firstDot.attributes('aria-current')).toBeUndefined();
    expect(secondDot.attributes('aria-current')).toBe('true');
  });

  it('sets data-active on the active dot only', () => {
    mockSelectedIndex.value = 0;
    const wrapper = mountComponent(CarouselDots);
    const [firstDot, secondDot] = wrapper.findAll('button');
    assert.isDefined(firstDot);
    assert.isDefined(secondDot);
    expect(firstDot.attributes('data-active')).toBe('true');
    expect(secondDot.attributes('data-active')).toBeUndefined();
  });

  it('calls scrollTo with the correct index when a dot is clicked', async () => {
    const wrapper = mountComponent(CarouselDots);
    const secondDot = wrapper.findAll('button')[1];
    assert.isDefined(secondDot);
    await secondDot.trigger('click');
    expect(mockScrollTo).toHaveBeenCalledOnce();
    expect(mockScrollTo).toHaveBeenCalledWith(1);
  });

  it('moves the active marker to the new selectedIndex after nextTick', async () => {
    const wrapper = mountComponent(CarouselDots);
    expect(wrapper.findAll('button')[0]?.attributes('aria-current')).toBe(
      'true',
    );

    mockSelectedIndex.value = 1;
    await nextTick();

    const [firstDot, secondDot] = wrapper.findAll('button');
    assert.isDefined(firstDot);
    assert.isDefined(secondDot);
    expect(firstDot.attributes('aria-current')).toBeUndefined();
    expect(secondDot.attributes('aria-current')).toBe('true');
  });
});
