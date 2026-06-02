import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTenantCss } from '../../../../server/utils/tenant-css';
import { deriveThemeColors } from '../../../../server/utils/theme';
import type { ThemeColors } from '../../../../server/schemas/store-settings';
import { logger } from '../../../../server/utils/logger';

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

  it('converts an OKLCH surface value to Safari-safe sRGB hex', () => {
    const derived = deriveThemeColors({
      ...coreColors,
      footerBackground: 'oklch(0.7 0.1 20)',
    });
    const css = generateTenantCss('test', derived);
    // Older Safari cannot parse oklch(); the emitted var must be sRGB.
    expect(css).toContain('--footer-background: #d68585;');
    expect(css).not.toContain('oklch(0.7 0.1 20)');
  });

  it('emits all six surface vars verbatim when every surface is set', () => {
    const derived = deriveThemeColors({
      ...coreColors,
      topBarBackground: '#111111',
      footerBackground: '#222222',
      navBarBackground: '#FFFFFF',
      siteBackground: '#FAFAFA',
      buttonBackground: '#824f4f',
      buttonPurchaseBackground: '#4a497e',
    });
    const css = generateTenantCss('test', derived);
    expect(css).toContain('--top-bar-background: #111111;');
    expect(css).toContain('--footer-background: #222222;');
    expect(css).toContain('--nav-bar-background: #FFFFFF;');
    expect(css).toContain('--site-background: #FAFAFA;');
    expect(css).toContain('--button-background: #824f4f;');
    expect(css).toContain('--button-purchase-background: #4a497e;');
  });

  it('emits the documented fallback chain when no surface is set', () => {
    const derived = deriveThemeColors({ ...coreColors });
    const css = generateTenantCss('test', derived);
    expect(css).toContain('--top-bar-background: var(--primary);');
    // The hardcoded OKLCH footer fallback is converted to sRGB hex.
    expect(css).toContain('--footer-background: #171717;');
    expect(css).toContain('--nav-bar-background: var(--muted);');
    expect(css).toContain('--site-background: var(--background);');
    expect(css).toContain('--button-background: var(--primary);');
    expect(css).toContain(
      '--button-purchase-background: var(--button-background);',
    );
  });

  it('chains buttonPurchaseBackground through buttonBackground when only buttonBackground is set', () => {
    const derived = deriveThemeColors({
      ...coreColors,
      buttonBackground: '#824f4f',
    });
    const css = generateTenantCss('test', derived);
    expect(css).toContain('--button-background: #824f4f;');
    expect(css).toContain(
      '--button-purchase-background: var(--button-background);',
    );
    // Order matters for cascade resolution: button-background must be
    // declared before button-purchase-background.
    const buttonIdx = css.indexOf('--button-background:');
    const purchaseIdx = css.indexOf('--button-purchase-background:');
    expect(buttonIdx).toBeGreaterThan(0);
    expect(purchaseIdx).toBeGreaterThan(buttonIdx);
  });

  it('emits no oklch() in the color block so older Safari can parse every var', () => {
    const derived = deriveThemeColors({
      ...coreColors,
      topBarBackground: 'oklch(0.5 0.16 175)',
      buttonBackground: '#824f4f',
    });
    const css = generateTenantCss('test', derived);
    // No override.css here: every emitted color var must be sRGB.
    expect(css).not.toMatch(/oklch\(/);
    expect(css).toContain('--primary: #00747a;');
  });
});

describe('generateTenantCss override.css', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('emits override entries with -- prefixed keys', () => {
    const derived = deriveThemeColors({ ...coreColors });
    const css = generateTenantCss('test', derived, null, {
      '--radius': '0',
      '--my-token': 'blue',
    });
    expect(css).toContain('--radius: 0;');
    expect(css).toContain('--my-token: blue;');
  });

  it('emits override block AFTER the standard color block in the same selector', () => {
    const derived = deriveThemeColors({ ...coreColors });
    const css = generateTenantCss('test', derived, null, {
      '--my-token': 'blue',
    });
    const selectorIdx = css.indexOf("[data-theme='test'] {");
    const standardIdx = css.indexOf('--primary:');
    const overrideIdx = css.indexOf('--my-token:');
    const closingIdx = css.indexOf('}', overrideIdx);
    expect(selectorIdx).toBeGreaterThanOrEqual(0);
    expect(standardIdx).toBeGreaterThan(selectorIdx);
    expect(overrideIdx).toBeGreaterThan(standardIdx);
    expect(closingIdx).toBeGreaterThan(overrideIdx);
  });

  it('lets an override of an existing standard var win by cascade order', () => {
    const derived = deriveThemeColors({ ...coreColors });
    const css = generateTenantCss('test', derived, null, {
      '--primary': 'oklch(0.5 0.2 30)',
    });
    const firstPrimary = css.indexOf('--primary:');
    const lastPrimary = css.lastIndexOf('--primary:');
    expect(firstPrimary).toBeGreaterThan(0);
    expect(lastPrimary).toBeGreaterThan(firstPrimary);
    expect(css).toContain('--primary: oklch(0.5 0.2 30);');
  });

  it('skips keys that do not start with -- and warns once per skipped key', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const derived = deriveThemeColors({ ...coreColors });
    const css = generateTenantCss('test', derived, null, {
      radius: '0',
      '}; body { display: none; }': 'red',
      '--ok': 'green',
    });
    expect(css).not.toContain('radius: 0;');
    expect(css).not.toContain('display: none');
    expect(css).toContain('--ok: green;');
    expect(warnSpy).toHaveBeenCalledTimes(2);
    // Logged context must contain the offending key, never the value.
    const calls = warnSpy.mock.calls;
    const flattened = JSON.stringify(calls);
    expect(flattened).not.toContain('"red"');
    expect(flattened).not.toContain('"0"');
  });

  it('produces output identical to baseline when override.css is empty or missing', () => {
    const derived = deriveThemeColors({ ...coreColors });
    const baseline = generateTenantCss('test', derived);
    const withNull = generateTenantCss('test', derived, null, null);
    const withEmpty = generateTenantCss('test', derived, null, {});
    expect(withNull).toBe(baseline);
    expect(withEmpty).toBe(baseline);
  });

  it('emits override values verbatim (only keys are validated)', () => {
    const derived = deriveThemeColors({ ...coreColors });
    const css = generateTenantCss('test', derived, null, {
      '--weird': '  spaced  value  ',
    });
    expect(css).toContain('--weird:   spaced  value  ;');
  });
});
