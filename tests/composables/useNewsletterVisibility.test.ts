// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed } from 'vue';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
let mockIsFeatureConfigured = (_name: string): boolean => false;
let mockHasFeature = (_name: string): boolean => false;
let mockCanAccess = (_name: string): boolean => false;

vi.stubGlobal('useTenant', () => ({
  isFeatureConfigured: (name: string) => mockIsFeatureConfigured(name),
  hasFeature: (name: string) => mockHasFeature(name),
}));

vi.stubGlobal('useFeatureAccess', () => ({
  canAccess: (name: string) => mockCanAccess(name),
}));

vi.stubGlobal('computed', computed);

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
    isFeatureConfigured: (name: string) => mockIsFeatureConfigured(name),
    hasFeature: (name: string) => mockHasFeature(name),
  }),
}));

vi.mock('../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canAccess: (name: string) => mockCanAccess(name),
  }),
}));

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------
const { useNewsletterVisibility, NEWSLETTER_FEATURE_KEY } =
  await import('../../app/composables/useNewsletterVisibility');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useNewsletterVisibility', () => {
  beforeEach(() => {
    mockIsFeatureConfigured = () => false;
    mockHasFeature = () => false;
    mockCanAccess = () => false;
  });

  it('shows the newsletter when the feature key is absent (show-by-default)', () => {
    mockIsFeatureConfigured = () => false;
    const { showNewsletter } = useNewsletterVisibility();
    expect(showNewsletter.value).toBe(true);
  });

  it('shows the newsletter when the feature is enabled: true with no access rule', () => {
    mockIsFeatureConfigured = (name) => name === NEWSLETTER_FEATURE_KEY;
    mockHasFeature = (name) => name === NEWSLETTER_FEATURE_KEY;
    // No access rule → canAccess resolves to 'all' → true.
    mockCanAccess = (name) => name === NEWSLETTER_FEATURE_KEY;
    const { showNewsletter } = useNewsletterVisibility();
    expect(showNewsletter.value).toBe(true);
  });

  it('hides the newsletter when the feature is explicitly enabled: false', () => {
    mockIsFeatureConfigured = (name) => name === NEWSLETTER_FEATURE_KEY;
    mockHasFeature = () => false;
    const { showNewsletter } = useNewsletterVisibility();
    expect(showNewsletter.value).toBe(false);
  });

  it('shows the newsletter only when authenticated for enabled + access: authenticated', () => {
    mockIsFeatureConfigured = (name) => name === NEWSLETTER_FEATURE_KEY;
    mockHasFeature = (name) => name === NEWSLETTER_FEATURE_KEY;

    // Anonymous: an 'authenticated' access rule denies → canAccess false → hidden.
    mockCanAccess = () => false;
    expect(useNewsletterVisibility().showNewsletter.value).toBe(false);

    // Authenticated: access rule passes → canAccess true → shown.
    mockCanAccess = (name) => name === NEWSLETTER_FEATURE_KEY;
    expect(useNewsletterVisibility().showNewsletter.value).toBe(true);
  });
});
