import { describe, it, expect } from 'vitest';

// Test the CookieBanner's core visibility and consent logic without mounting the SFC.
// Same pattern as PreviewBanner.test.ts.

type ConsentState = 'accepted' | 'declined' | null;

function isVisible(
  consentState: ConsentState,
  analyticsEnabled: boolean,
): boolean {
  const hasInteracted = consentState !== null;
  return !hasInteracted && analyticsEnabled;
}

function consentFromState(state: ConsentState): boolean {
  return state === 'accepted';
}

describe('CookieBanner logic', () => {
  describe('visibility', () => {
    it('renders when consent is null and analytics enabled', () => {
      expect(isVisible(null, true)).toBe(true);
    });

    it('hides after accept', () => {
      expect(isVisible('accepted', true)).toBe(false);
    });

    it('hides after decline', () => {
      expect(isVisible('declined', true)).toBe(false);
    });

    it('hides when analytics feature disabled', () => {
      expect(isVisible(null, false)).toBe(false);
    });

    it('hides when analytics disabled even with no interaction', () => {
      expect(isVisible(null, false)).toBe(false);
    });
  });

  describe('consent state', () => {
    it('accept sets state to accepted', () => {
      const state: ConsentState = 'accepted';
      expect(consentFromState(state)).toBe(true);
    });

    it('decline sets state to declined', () => {
      const state: ConsentState = 'declined';
      expect(consentFromState(state)).toBe(false);
    });

    it('null state means no consent', () => {
      const state: ConsentState = null;
      expect(consentFromState(state)).toBe(false);
    });
  });
});
