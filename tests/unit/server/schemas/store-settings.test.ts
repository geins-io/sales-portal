import { describe, it, expect } from 'vitest';
import {
  ThemeColorsSchema,
  OverrideConfigSchema,
  ContactSocialSchema,
  FeatureConfigInputSchema,
} from '../../../../server/schemas/store-settings';

const baseCore = {
  primary: 'oklch(0.5 0.1 200)',
  primaryForeground: 'oklch(0.9 0 0)',
  secondary: 'oklch(0.8 0 0)',
  secondaryForeground: 'oklch(0.2 0 0)',
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.1 0 0)',
};

describe('ThemeColorsSchema topBarBackground', () => {
  it('accepts a 6-digit lowercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: '#f084ec',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a 6-digit uppercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: '#F084EC',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid OKLCH value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: 'oklch(0.7 0.1 20)',
    });
    expect(result.success).toBe(true);
  });

  it('coerces a 3-digit hex shorthand', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: '#fff',
    });
    expect(result.success).toBe(true);
  });

  it('coerces an 8-digit hex (alpha channel preserved)', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: '#ff00aabb',
    });
    expect(result.success).toBe(true);
  });

  it('coerces a CSS named color', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: 'red',
    });
    expect(result.success).toBe(true);
  });

  it('coerces an rgb() value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: 'rgb(234, 232, 220)',
    });
    expect(result.success).toBe(true);
  });

  it('coerces an hsl() value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: 'hsl(120, 50%, 50%)',
    });
    expect(result.success).toBe(true);
  });

  it('accepts `#eae8dc99` (regression for 8-digit hex with alpha)', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: '#eae8dc99',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unparseable garbage', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      topBarBackground: 'not-a-color',
    });
    expect(result.success).toBe(false);
  });

  it('treats topBarBackground as optional', () => {
    const result = ThemeColorsSchema.safeParse({ ...baseCore });
    expect(result.success).toBe(true);
  });
});

describe('ThemeColorsSchema footerBackground', () => {
  it('accepts a 6-digit lowercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: '#d241b3',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a 6-digit uppercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: '#D241B3',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid OKLCH value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: 'oklch(0.6 0.2 350)',
    });
    expect(result.success).toBe(true);
  });

  it('coerces a 3-digit hex shorthand', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: '#fff',
    });
    expect(result.success).toBe(true);
  });

  it('coerces an 8-digit hex (alpha channel preserved)', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: '#ff00aabb',
    });
    expect(result.success).toBe(true);
  });

  it('coerces a CSS named color', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      footerBackground: 'blue',
    });
    expect(result.success).toBe(true);
  });

  it('treats footerBackground as optional', () => {
    const result = ThemeColorsSchema.safeParse({ ...baseCore });
    expect(result.success).toBe(true);
  });
});

describe.each([
  'navBarBackground',
  'siteBackground',
  'buttonBackground',
  'buttonPurchaseBackground',
] as const)('ThemeColorsSchema %s surface field', (field) => {
  it('accepts a 6-digit lowercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      [field]: '#824f4f',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a 6-digit uppercase hex value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      [field]: '#FAFAFA',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid OKLCH value', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      [field]: 'oklch(0.6 0.05 280)',
    });
    expect(result.success).toBe(true);
  });

  it('coerces a 3-digit hex shorthand', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      [field]: '#fff',
    });
    expect(result.success).toBe(true);
  });

  it('coerces an 8-digit hex (alpha channel preserved)', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      [field]: '#ff00aabb',
    });
    expect(result.success).toBe(true);
  });

  it('coerces a CSS named color', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      [field]: 'green',
    });
    expect(result.success).toBe(true);
  });

  it(`treats ${field} as optional`, () => {
    const result = ThemeColorsSchema.safeParse({ ...baseCore });
    expect(result.success).toBe(true);
  });
});

describe('ThemeColorsSchema coercion on core + optional palette', () => {
  it('coerces hex on the standard primary color', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      primary: '#ff0000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.primary).toMatch(
        /^oklch\([\d.]+ [\d.]+ [\d.]+( \/ [\d.]+)?\)$/,
      );
    }
  });

  it('coerces hex on an optional standard color (destructive)', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      destructive: '#ff0000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unparseable garbage on a core color', () => {
    const result = ThemeColorsSchema.safeParse({
      ...baseCore,
      primary: 'not-a-color',
    });
    expect(result.success).toBe(false);
  });
});

describe('ContactSocialSchema URL validation', () => {
  const SOCIAL_FIELDS = [
    'facebook',
    'instagram',
    'twitter',
    'linkedin',
    'youtube',
  ] as const;

  const HOSTILE_VALUES = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox("xss")',
  ];

  for (const field of SOCIAL_FIELDS) {
    for (const hostile of HOSTILE_VALUES) {
      it(`rejects ${hostile} for ${field}`, () => {
        const result = ContactSocialSchema.safeParse({ [field]: hostile });
        expect(result.success).toBe(false);
      });
    }

    it(`accepts a valid https URL for ${field}`, () => {
      const result = ContactSocialSchema.safeParse({
        [field]: 'https://facebook.com/acme',
      });
      expect(result.success).toBe(true);
    });

    it(`accepts null for ${field}`, () => {
      const result = ContactSocialSchema.safeParse({ [field]: null });
      expect(result.success).toBe(true);
    });

    it(`accepts an omitted ${field}`, () => {
      const result = ContactSocialSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  }
});

describe('OverrideConfigSchema css', () => {
  it('treats css as optional', () => {
    const result = OverrideConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('treats the entire override block as optional', () => {
    const result = OverrideConfigSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('accepts an arbitrary string-to-string record', () => {
    const result = OverrideConfigSchema.safeParse({
      css: { '--radius': '0', '--my-token': 'blue', radius: '0' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-string values', () => {
    const result = OverrideConfigSchema.safeParse({
      css: { '--radius': 0 },
    });
    expect(result.success).toBe(false);
  });
});

describe('FeatureConfigInputSchema bare-boolean shorthand', () => {
  it('normalizes a bare `true` to { enabled: true }', () => {
    const result = FeatureConfigInputSchema.safeParse(true);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ enabled: true });
    }
  });

  it('normalizes a bare `false` to { enabled: false }', () => {
    const result = FeatureConfigInputSchema.safeParse(false);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ enabled: false });
    }
  });

  it('still accepts the full object form with an access rule', () => {
    const result = FeatureConfigInputSchema.safeParse({
      enabled: true,
      access: 'authenticated',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ enabled: true, access: 'authenticated' });
    }
  });

  it('still accepts the bare object form without an access rule', () => {
    const result = FeatureConfigInputSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ enabled: false });
    }
  });

  it('rejects a number (not a valid feature config)', () => {
    const result = FeatureConfigInputSchema.safeParse(1);
    expect(result.success).toBe(false);
  });

  it('rejects a string (not a valid feature config)', () => {
    const result = FeatureConfigInputSchema.safeParse('true');
    expect(result.success).toBe(false);
  });
});
