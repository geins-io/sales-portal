import { describe, it, expect } from 'vitest';
import { deriveThemeColors } from '../../../../server/utils/theme';
import type { ThemeColors } from '../../../../server/schemas/store-settings';

const coreColors: ThemeColors = {
  primary: 'oklch(0.5 0.1 200)',
  primaryForeground: 'oklch(0.9 0 0)',
  secondary: 'oklch(0.8 0 0)',
  secondaryForeground: 'oklch(0.2 0 0)',
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.1 0 0)',
};

describe('deriveThemeColors surface forwarding', () => {
  it('forwards every surface key end-to-end when set', () => {
    const result = deriveThemeColors({
      ...coreColors,
      topBarBackground: '#111111',
      footerBackground: '#222222',
      navBarBackground: '#FFFFFF',
      siteBackground: '#FAFAFA',
      buttonBackground: '#824f4f',
      buttonPurchaseBackground: '#4a497e',
      buttonText: '#f1e2d3',
      buttonPurchaseText: '#d3e2f1',
    });
    expect(result.topBarBackground).toBe('#111111');
    expect(result.footerBackground).toBe('#222222');
    expect(result.navBarBackground).toBe('#FFFFFF');
    expect(result.siteBackground).toBe('#FAFAFA');
    expect(result.buttonBackground).toBe('#824f4f');
    expect(result.buttonPurchaseBackground).toBe('#4a497e');
    expect(result.buttonText).toBe('#f1e2d3');
    expect(result.buttonPurchaseText).toBe('#d3e2f1');
  });

  it('collapses unset surface keys to the empty-string sentinel', () => {
    const result = deriveThemeColors({ ...coreColors });
    expect(result.navBarBackground).toBe('');
    expect(result.siteBackground).toBe('');
    expect(result.buttonBackground).toBe('');
    expect(result.buttonPurchaseBackground).toBe('');
    expect(result.buttonText).toBe('');
    expect(result.buttonPurchaseText).toBe('');
  });

  it('returns 42 keys total (32 standard + 10 surfaces)', () => {
    const result = deriveThemeColors({ ...coreColors });
    expect(Object.keys(result)).toHaveLength(42);
  });
});
