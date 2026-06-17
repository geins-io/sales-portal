// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ref } from 'vue';

// ---------------------------------------------------------------------------
// Locale loading
// Read raw JSON from disk; a plain import would yield compiled message
// functions from the @nuxtjs/i18n bundler, not source strings.
// ---------------------------------------------------------------------------
function loadLocale(name: string): { product: { image_alt_counter: string } } {
  const path = join(process.cwd(), 'app', 'locales', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}
const en = loadLocale('en');
const sv = loadLocale('sv');

// ---------------------------------------------------------------------------
// vue-i18n stub
// The active locale is mutable so individual tests can switch between en/sv.
// ---------------------------------------------------------------------------
let activeLocale = 'en';

function translateForTest(
  key: string,
  params: Record<string, unknown> = {},
): string {
  const templates: Record<string, string> = {
    'product.image_alt_counter':
      activeLocale === 'sv'
        ? sv.product.image_alt_counter
        : en.product.image_alt_counter,
  };
  const template = templates[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in params ? String(params[k]) : `{${k}}`,
  );
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: translateForTest, locale: ref(activeLocale) }),
}));
vi.stubGlobal('useI18n', () => ({
  t: translateForTest,
  locale: ref(activeLocale),
}));

// ---------------------------------------------------------------------------
// Subject (lazy import so mocks are installed first)
// ---------------------------------------------------------------------------
const { useProductImageAlt } = await import(
  '../../app/composables/useProductImageAlt'
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useProductImageAlt', () => {
  beforeEach(() => {
    activeLocale = 'en';
  });

  describe('single image (no counter)', () => {
    it('returns product name when total is omitted', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      const result = buildProductImageAlt({ name: 'Bosch Rotary Hammer' });
      expect(result).toBe('Bosch Rotary Hammer');
      expect(result).not.toMatch(/\(\d+ (of|av) \d+\)/);
    });

    it('returns product name when total is 1', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      const result = buildProductImageAlt({
        name: 'Bosch Rotary Hammer',
        total: 1,
      });
      expect(result).toBe('Bosch Rotary Hammer');
      expect(result).not.toMatch(/\(\d+ (of|av) \d+\)/);
    });
  });

  describe('multiple images (counter)', () => {
    it('returns name with 1-based counter for first image', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      expect(
        buildProductImageAlt({
          name: 'Bosch Rotary Hammer',
          index: 0,
          total: 4,
        }),
      ).toBe('Bosch Rotary Hammer (1 of 4)');
    });

    it('returns name with 1-based counter for last image', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      expect(
        buildProductImageAlt({
          name: 'Bosch Rotary Hammer',
          index: 3,
          total: 4,
        }),
      ).toBe('Bosch Rotary Hammer (4 of 4)');
    });

    it('defaults index to 0 when total > 1 and index is omitted', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      expect(
        buildProductImageAlt({ name: 'Bosch Rotary Hammer', total: 4 }),
      ).toBe('Bosch Rotary Hammer (1 of 4)');
    });
  });

  describe('manualAlt override', () => {
    it('returns manualAlt verbatim, wins over counter', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      const result = buildProductImageAlt({
        name: 'Bosch Rotary Hammer',
        index: 1,
        total: 3,
        manualAlt: 'Drill bit close-up on a workbench',
      });
      expect(result).toBe('Drill bit close-up on a workbench');
      expect(result).not.toMatch(/\(\d+ (of|av) \d+\)/);
    });

    it('returns manualAlt untrimmed (verbatim with surrounding spaces)', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      const result = buildProductImageAlt({
        name: 'Bosch Rotary Hammer',
        manualAlt: '  Padded label  ',
      });
      expect(result).toBe('  Padded label  ');
    });

    it('treats whitespace-only manualAlt as empty and falls through to name', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      const result = buildProductImageAlt({
        name: 'Bosch Rotary Hammer',
        total: 1,
        manualAlt: '   ',
      });
      expect(result).toBe('Bosch Rotary Hammer');
      expect(result).not.toMatch(/\(\d+ (of|av) \d+\)/);
    });

    it('treats null manualAlt as absent and falls through to name', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      const result = buildProductImageAlt({
        name: 'Bosch Rotary Hammer',
        manualAlt: null,
      });
      expect(result).toBe('Bosch Rotary Hammer');
      expect(result).not.toBe('null');
    });

    it('treats undefined manualAlt as absent and falls through to name', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      const result = buildProductImageAlt({
        name: 'Bosch Rotary Hammer',
        manualAlt: undefined,
      });
      expect(result).toBe('Bosch Rotary Hammer');
    });
  });

  describe('decorative flag', () => {
    it('returns empty string when decorative is true', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      expect(
        buildProductImageAlt({ name: 'Bosch Rotary Hammer', decorative: true }),
      ).toBe('');
    });

    it('decorative wins over manualAlt and counter', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      expect(
        buildProductImageAlt({
          name: 'Bosch Rotary Hammer',
          index: 0,
          total: 4,
          manualAlt: 'Some alt',
          decorative: true,
        }),
      ).toBe('');
    });
  });

  describe('no forbidden prefixes', () => {
    it('multi-image result does not start with image/photo/picture prefix', () => {
      const { buildProductImageAlt } = useProductImageAlt();
      const result = buildProductImageAlt({
        name: 'Bosch Rotary Hammer',
        index: 0,
        total: 4,
      });
      expect(result).not.toMatch(/^\s*(image|photo|picture)\s+of/i);
    });
  });

  describe('locale-aware counter', () => {
    it('produces "(1 of 4)" in English', () => {
      activeLocale = 'en';
      const { buildProductImageAlt } = useProductImageAlt();
      expect(
        buildProductImageAlt({
          name: 'Bosch Rotary Hammer',
          index: 0,
          total: 4,
        }),
      ).toBe('Bosch Rotary Hammer (1 of 4)');
    });

    it('produces "(1 av 4)" in Swedish', () => {
      activeLocale = 'sv';
      const { buildProductImageAlt } = useProductImageAlt();
      expect(
        buildProductImageAlt({
          name: 'Bosch Rotary Hammer',
          index: 0,
          total: 4,
        }),
      ).toBe('Bosch Rotary Hammer (1 av 4)');
    });
  });

  describe('shipped locale string guarantees', () => {
    it('en template contains " of " word', () => {
      expect(en.product.image_alt_counter).toContain(' of ');
    });

    it('sv template contains " av " word', () => {
      expect(sv.product.image_alt_counter).toContain(' av ');
    });

    it('en template has no em dash or en dash', () => {
      expect(en.product.image_alt_counter).not.toMatch(/[—–]/);
    });

    it('sv template has no em dash or en dash', () => {
      expect(sv.product.image_alt_counter).not.toMatch(/[—–]/);
    });

    it('en template does not start with image/photo/picture prefix', () => {
      expect(en.product.image_alt_counter).not.toMatch(
        /(image|photo|picture)\s+of/i,
      );
    });

    it('sv template does not start with image/photo/picture prefix', () => {
      expect(sv.product.image_alt_counter).not.toMatch(
        /(image|photo|picture)\s+of/i,
      );
    });
  });
});
