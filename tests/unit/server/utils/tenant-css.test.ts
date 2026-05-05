import { describe, it, expect } from 'vitest';
import { generateTenantCss } from '../../../../server/utils/tenant-css';
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

describe('generateTenantCss surface colors', () => {
  it('emits --top-bar-background as a hex value when provided', () => {
    const derived = deriveThemeColors({
      ...coreColors,
      topBarBackground: '#f084ec',
    });
    const css = generateTenantCss('test', derived);
    expect(css).toContain('--top-bar-background: #f084ec;');
    // Lives inside the same theme selector as the standard color vars.
    expect(css).toContain("[data-theme='test']");
    expect(css).toContain('--primary:');
  });

  it('emits --footer-background as an OKLCH value when provided', () => {
    const derived = deriveThemeColors({
      ...coreColors,
      footerBackground: 'oklch(0.7 0.1 20)',
    });
    const css = generateTenantCss('test', derived);
    expect(css).toContain('--footer-background: oklch(0.7 0.1 20);');
  });

  it('omits both surface vars when neither is set', () => {
    const derived = deriveThemeColors({ ...coreColors });
    const css = generateTenantCss('test', derived);
    expect(css).not.toContain('--top-bar-background');
    expect(css).not.toContain('--footer-background');
  });
});
