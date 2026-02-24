import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ReviewCard from '../../../app/components/product/ReviewCard.vue';

const iconStub = {
  template: '<span class="icon" :data-name="name" :class="$attrs.class" />',
  props: ['name'],
  inheritAttrs: false,
};

const stubs = {
  Icon: iconStub,
  NuxtIcon: iconStub,
};

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    rating: 4,
    comment: 'Great product, highly recommend!',
    reviewDate: '2025-12-15T10:00:00Z',
    author: 'John Doe',
    ...overrides,
  };
}

describe('ReviewCard', () => {
  it('renders author name', () => {
    const wrapper = mountComponent(ReviewCard, {
      props: { review: makeReview() },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="review-author"]').text()).toBe(
      'John Doe',
    );
  });

  it('renders comment', () => {
    const wrapper = mountComponent(ReviewCard, {
      props: { review: makeReview() },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="review-comment"]').text()).toBe(
      'Great product, highly recommend!',
    );
  });

  it('renders star rating with correct count', () => {
    const wrapper = mountComponent(ReviewCard, {
      props: { review: makeReview({ rating: 4 }) },
      global: { stubs },
    });
    const stars = wrapper.findAll('[data-testid="star-rating"] .icon');
    expect(stars.length).toBe(5);
    // 4 filled stars (amber class)
    const filled = stars.filter((s) => s.classes().includes('text-amber-500'));
    expect(filled.length).toBe(4);
  });

  it('renders formatted date', () => {
    const wrapper = mountComponent(ReviewCard, {
      props: { review: makeReview() },
      global: { stubs },
    });
    // Date formatting varies by locale, just check it's rendered
    const text = wrapper.text();
    expect(text).toMatch(/\d/);
  });
});
