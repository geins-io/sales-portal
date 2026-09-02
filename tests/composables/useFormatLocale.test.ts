import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

const mockLocaleRef = ref('en');
const mockTenantLocales = ref<string[]>(['sv-SE', 'en-GB', 'nb-NO']);

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ locale: mockLocaleRef }),
}));

vi.mock('~/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: computed(() => ({ availableLocales: mockTenantLocales.value })),
  }),
}));

vi.stubGlobal('computed', computed);
vi.stubGlobal('ref', ref);
vi.stubGlobal('useI18n', () => ({ locale: mockLocaleRef }));

const { useFormatLocale } = await import('~/composables/useFormatLocale');

describe('useFormatLocale', () => {
  beforeEach(() => {
    mockLocaleRef.value = 'en';
    mockTenantLocales.value = ['sv-SE', 'en-GB', 'nb-NO'];
  });

  it("expands the active locale to the tenant's own BCP-47 tag", () => {
    const { formatLocale } = useFormatLocale();
    // en-GB, not en: an en-GB tenant must not get US number and date shapes.
    expect(formatLocale.value).toBe('en-GB');
  });

  it('follows a locale switch', () => {
    const { formatLocale } = useFormatLocale();
    mockLocaleRef.value = 'nb';
    expect(formatLocale.value).toBe('nb-NO');
    mockLocaleRef.value = 'sv';
    expect(formatLocale.value).toBe('sv-SE');
  });

  it('falls back to the short code when the tenant carries no matching tag', () => {
    mockLocaleRef.value = 'fi';
    const { formatLocale } = useFormatLocale();
    expect(formatLocale.value).toBe('fi');
  });

  it('falls back to the short code when the tenant has no locales at all', () => {
    mockTenantLocales.value = [];
    const { formatLocale } = useFormatLocale();
    expect(formatLocale.value).toBe('en');
  });
});
