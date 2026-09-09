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

  // Sentinels are greyscale OKLCH with L in steps of 0.05, which makes each
  // expected hex a pure function of L and keeps neighbours a clear byte apart.
  // OKLCH rather than hex because that is the only shape the app receives: the
  // store settings schema normalises every colour through coerceToOklch, and
  // toSafariSafeColor returns a non-oklch value untouched, so a hex fixture
  // would skip the conversion these vars depend on. L 0.20 and 0.25 are kept
  // away from footerBackground, whose fallback #171717 sits next to L 0.20's
  // #161616. Expected values are written literally: running the sentinel
  // through the converter here would only prove the converter agrees with
  // itself.
  it('emits all six surface vars as converted sRGB when every surface is set', () => {
    const derived = deriveThemeColors({
      ...coreColors,
      topBarBackground: 'oklch(0.30 0 0)',
      footerBackground: 'oklch(0.35 0 0)',
      navBarBackground: 'oklch(0.40 0 0)',
      siteBackground: 'oklch(0.45 0 0)',
      buttonBackground: 'oklch(0.50 0 0)',
      buttonPurchaseBackground: 'oklch(0.55 0 0)',
    });
    const css = generateTenantCss('test', derived);
    expect(css).toContain('--top-bar-background: #2e2e2e;');
    expect(css).toContain('--footer-background: #3a3a3a;');
    expect(css).toContain('--nav-bar-background: #484848;');
    expect(css).toContain('--site-background: #555555;');
    expect(css).toContain('--button-background: #636363;');
    expect(css).toContain('--button-purchase-background: #717171;');
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
    // The two text surfaces fall back through the same chain: one to a var
    // reference, one to a hardcoded OKLCH that is converted like any other.
    expect(css).toContain('--top-bar-text: var(--primary-foreground);');
    expect(css).toContain('--footer-text: #cecece;');
  });

  it('chains buttonPurchaseBackground through buttonBackground when only buttonBackground is set', () => {
    const derived = deriveThemeColors({
      ...coreColors,
      buttonBackground: 'oklch(0.50 0 0)',
    });
    const css = generateTenantCss('test', derived);
    expect(css).toContain('--button-background: #636363;');
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
    // Both surfaces are OKLCH: a hex input satisfies the negative assertion
    // below without the emitter having converted anything.
    const derived = deriveThemeColors({
      ...coreColors,
      topBarBackground: 'oklch(0.5 0.16 175)',
      buttonBackground: 'oklch(0.50 0 0)',
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

/**
 * One test per colour group the type names, seven groups over the 34 keys plus
 * the three typography families.
 *
 * A test may hang on several cells only when the fixture writes each of them
 * and a separate assertion discriminates each one: flip one sentinel and
 * exactly that assertion falls. The assertions are driven off the same table
 * the fixture is built from, so a key cannot be written without also being
 * asserted — the flip proof shows the flipped key's assertion bites, and the
 * table is what guarantees its siblings have one at all.
 *
 * Sentinels are greyscale OKLCH (chroma 0, hue 0) with L in steps of 0.05.
 * Greyscale makes the emitted hex a pure function of L, so each expected value
 * is checkable in one line. Do not tighten the step: two L values a hundredth
 * apart can round to the same hex, and then an assertion passes on a
 * neighbour's value. Each sentinel is also chosen to differ from the value its
 * own key falls back to when unset — `footerText` must never get L 0.85,
 * because its fallback `oklch(0.85 0 0)` converts to the same `#cecece` and the
 * test would pass with the configured value dropped.
 *
 * Expected hex values are written literally. Running the sentinel through
 * `toSafariSafeColor` inside the assertion would only prove the converter
 * agrees with itself, and a conversion regression would keep it green.
 */
type ColorCase = [
  key: keyof ThemeColors,
  cssVar: string,
  sentinel: string,
  expected: string,
];

/** The shared core fixture every group below writes; the core group's own sentinels. */
const CORE_CASES: ColorCase[] = [
  ['primary', '--primary', 'oklch(0.20 0 0)', '#161616'],
  ['primaryForeground', '--primary-foreground', 'oklch(0.25 0 0)', '#222222'],
  ['secondary', '--secondary', 'oklch(0.30 0 0)', '#2e2e2e'],
  [
    'secondaryForeground',
    '--secondary-foreground',
    'oklch(0.35 0 0)',
    '#3a3a3a',
  ],
  ['background', '--background', 'oklch(0.40 0 0)', '#484848'],
  ['foreground', '--foreground', 'oklch(0.45 0 0)', '#555555'],
];

const CORE_SENTINELS: ThemeColors = {
  primary: 'oklch(0.20 0 0)',
  primaryForeground: 'oklch(0.25 0 0)',
  secondary: 'oklch(0.30 0 0)',
  secondaryForeground: 'oklch(0.35 0 0)',
  background: 'oklch(0.40 0 0)',
  foreground: 'oklch(0.45 0 0)',
};

function emitFor(cases: ColorCase[], base: ThemeColors = CORE_SENTINELS) {
  const overrides: Partial<Record<keyof ThemeColors, string>> = {};
  for (const [key, , sentinel] of cases) overrides[key] = sentinel;
  return generateTenantCss(
    'test',
    deriveThemeColors({ ...base, ...overrides }),
  );
}

function expectEachCase(css: string, cases: ColorCase[]) {
  for (const [key, cssVar, , expected] of cases) {
    expect(css, key).toContain(`${cssVar}: ${expected};`);
  }
}

describe('generateTenantCss configured colours reach their CSS variable', () => {
  it('emits each of the six core colours as its own converted variable', () => {
    expectEachCase(emitFor(CORE_CASES), CORE_CASES);
  });

  it('emits each of the ten semantic surface colours as its own converted variable', () => {
    const cases: ColorCase[] = [
      ['card', '--card', 'oklch(0.50 0 0)', '#636363'],
      ['cardForeground', '--card-foreground', 'oklch(0.55 0 0)', '#717171'],
      ['popover', '--popover', 'oklch(0.60 0 0)', '#808080'],
      [
        'popoverForeground',
        '--popover-foreground',
        'oklch(0.65 0 0)',
        '#8f8f8f',
      ],
      ['muted', '--muted', 'oklch(0.70 0 0)', '#9e9e9e'],
      ['mutedForeground', '--muted-foreground', 'oklch(0.75 0 0)', '#aeaeae'],
      ['accent', '--accent', 'oklch(0.80 0 0)', '#bebebe'],
      ['accentForeground', '--accent-foreground', 'oklch(0.85 0 0)', '#cecece'],
      ['destructive', '--destructive', 'oklch(0.90 0 0)', '#dedede'],
      [
        'destructiveForeground',
        '--destructive-foreground',
        'oklch(0.95 0 0)',
        '#eeeeee',
      ],
    ];
    expectEachCase(emitFor(cases), cases);
  });

  it('emits each of the three edge colours as its own converted variable', () => {
    const cases: ColorCase[] = [
      ['border', '--border', 'oklch(0.50 0 0)', '#636363'],
      ['input', '--input', 'oklch(0.55 0 0)', '#717171'],
      ['ring', '--ring', 'oklch(0.60 0 0)', '#808080'],
    ];
    expectEachCase(emitFor(cases), cases);
  });

  it('emits each of the five chart colours as its own converted variable', () => {
    const cases: ColorCase[] = [
      ['chart1', '--chart-1', 'oklch(0.50 0 0)', '#636363'],
      ['chart2', '--chart-2', 'oklch(0.55 0 0)', '#717171'],
      ['chart3', '--chart-3', 'oklch(0.60 0 0)', '#808080'],
      ['chart4', '--chart-4', 'oklch(0.65 0 0)', '#8f8f8f'],
      ['chart5', '--chart-5', 'oklch(0.70 0 0)', '#9e9e9e'],
    ];
    expectEachCase(emitFor(cases), cases);
  });

  it('emits each of the eight sidebar colours as its own converted variable', () => {
    const cases: ColorCase[] = [
      ['sidebar', '--sidebar', 'oklch(0.50 0 0)', '#636363'],
      [
        'sidebarForeground',
        '--sidebar-foreground',
        'oklch(0.55 0 0)',
        '#717171',
      ],
      ['sidebarPrimary', '--sidebar-primary', 'oklch(0.60 0 0)', '#808080'],
      [
        'sidebarPrimaryForeground',
        '--sidebar-primary-foreground',
        'oklch(0.65 0 0)',
        '#8f8f8f',
      ],
      ['sidebarAccent', '--sidebar-accent', 'oklch(0.70 0 0)', '#9e9e9e'],
      [
        'sidebarAccentForeground',
        '--sidebar-accent-foreground',
        'oklch(0.75 0 0)',
        '#aeaeae',
      ],
      ['sidebarBorder', '--sidebar-border', 'oklch(0.80 0 0)', '#bebebe'],
      ['sidebarRing', '--sidebar-ring', 'oklch(0.85 0 0)', '#cecece'],
    ];
    expectEachCase(emitFor(cases), cases);
  });

  it('emits both surface text colours as their own converted variable', () => {
    // L 0.85 is deliberately absent here: it is footerText's own fallback.
    const cases: ColorCase[] = [
      ['topBarText', '--top-bar-text', 'oklch(0.50 0 0)', '#636363'],
      ['footerText', '--footer-text', 'oklch(0.55 0 0)', '#717171'],
    ];
    expectEachCase(emitFor(cases), cases);
  });

  it('emits each of the three typography families as its own variable', () => {
    // Font names, not colours, and each family has its own fallback stack.
    const cases: Array<[key: string, expected: string]> = [
      [
        'fontFamily',
        "--font-family: 'Sentinel Body', ui-sans-serif, system-ui, sans-serif;",
      ],
      [
        'headingFontFamily',
        "--heading-font-family: 'Sentinel Heading', ui-sans-serif, system-ui, sans-serif;",
      ],
      [
        'monoFontFamily',
        "--mono-font-family: 'Sentinel Mono', ui-monospace, 'SFMono-Regular', monospace;",
      ],
    ];
    const css = generateTenantCss(
      'test',
      deriveThemeColors({ ...CORE_SENTINELS }),
      null,
      null,
      {
        fontFamily: 'Sentinel Body',
        headingFontFamily: 'Sentinel Heading',
        monoFontFamily: 'Sentinel Mono',
      },
    );
    for (const [key, expected] of cases) {
      expect(css, key).toContain(expected);
    }
  });
});
