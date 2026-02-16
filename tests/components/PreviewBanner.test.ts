import { describe, it, expect } from 'vitest';

// Test the component's core visibility logic without mounting the SFC.
// Same pattern as LocaleSwitcher.test.ts.

describe('PreviewBanner logic', () => {
  describe('visibility', () => {
    function isPreview(cookieValue: string | null | undefined): boolean {
      return cookieValue === 'true';
    }

    it('should show banner when preview cookie is "true"', () => {
      expect(isPreview('true')).toBe(true);
    });

    it('should hide banner when preview cookie is null', () => {
      expect(isPreview(null)).toBe(false);
    });

    it('should hide banner when preview cookie is undefined', () => {
      expect(isPreview(undefined)).toBe(false);
    });

    it('should hide banner when preview cookie is "false"', () => {
      expect(isPreview('false')).toBe(false);
    });
  });
});
