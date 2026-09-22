import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocked at the SDK boundary, and the area mock answers as a function of the
// arguments it is handed: a collection with no language filter is returned for
// whatever languageId is asked for, a filtered one only for its own. That is
// what the Merchant API does, measured on a registered tenant, and it is what
// makes these assertions fail if the query stops carrying a language.
// ---------------------------------------------------------------------------
const mockAreaGet = vi.fn();

const mockSDK = {
  core: { geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' } },
  cms: { menu: { get: vi.fn() }, area: { get: mockAreaGet } },
};

let currentLocale = 'sv-SE';

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi.fn(() => ({
    channelId: '1',
    languageId: currentLocale,
    marketId: 'se',
  })),
  buildRequestContext: vi.fn().mockReturnValue(undefined),
}));

const previewCookieMock = vi.fn().mockReturnValue(false);

function stubGlobals() {
  vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
  vi.stubGlobal('getPreviewCookie', previewCookieMock);
  vi.stubGlobal(
    'getRequestLocale',
    vi.fn(() => currentLocale),
  );
  vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue('se'));
  vi.stubGlobal('getCustomerType', vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue(undefined));
  vi.stubGlobal('getCookie', () => undefined);
}

stubGlobals();

function mockEvent(hostname = 'test.com') {
  return {
    context: { tenant: { hostname } },
    _cookies: {},
  } as unknown as import('h3').H3Event;
}

const AREA = { family: 'Frontpage', areaName: 'Content' };
const POPULATED = { containers: [{ id: '1', content: [{ config: {} }] }] };
/** A container shell with no widgets — what `hasContent` counts as empty. */
const EMPTY_SHELL = { containers: [{ id: '1', content: [] }] };

/** Every languageId the tenant serves, default language first. */
const LOCALES = ['sv-SE', 'de-DE', 'en-GB', 'fi-FI', 'da-DK', 'nb-NO'];

function languageIdsSent(): unknown[] {
  return mockAreaGet.mock.calls.map(
    ([vars]) => (vars as Record<string, unknown>).languageId,
  );
}

describe('getContentArea — language filtering', () => {
  let getContentArea: typeof import('../../../server/services/cms').getContentArea;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    stubGlobals();
    currentLocale = 'sv-SE';
    previewCookieMock.mockReturnValue(false);
    const mod = await import('../../../server/services/cms');
    getContentArea = mod.getContentArea;
  });

  it('leaves an area empty when the language filter excluded its collection', async () => {
    // The Merchant API answers a filtered-away area with no collection at all.
    currentLocale = 'de-DE';
    mockAreaGet.mockResolvedValue(null);

    const result = await getContentArea(AREA, mockEvent());

    expect(result.containers).toEqual([]);
    // The desktop and mobile legs, and nothing else.
    expect(mockAreaGet).toHaveBeenCalledTimes(2);
    expect(languageIdsSent()).toEqual(['de-DE', 'de-DE']);
  });

  it('does not re-ask without a language when the area came back empty', async () => {
    // Container shells with no widgets are the input that has to stay empty:
    // it is the shape that reads as empty, so it is where a retry would hide.
    currentLocale = 'de-DE';
    mockAreaGet.mockResolvedValue(EMPTY_SHELL);

    const result = await getContentArea(AREA, mockEvent());

    expect(result.containers).toHaveLength(1);
    expect(result.containers?.[0]?.content).toEqual([]);
    expect(mockAreaGet).toHaveBeenCalledTimes(2);
    expect(languageIdsSent()).toEqual(['de-DE', 'de-DE']);
  });

  it('renders an unfiltered area on every language the tenant serves', async () => {
    // An unfiltered collection answers whatever language it is asked for, so
    // the mock does too — and returns nothing for any other language, which is
    // what fails this test if the query ever goes out without one.
    mockAreaGet.mockImplementation(async (vars: Record<string, unknown>) =>
      vars.languageId === currentLocale ? POPULATED : null,
    );

    for (const locale of LOCALES) {
      currentLocale = locale;
      const result = await getContentArea(AREA, mockEvent());

      expect(result.containers, `no content for ${locale}`).toHaveLength(1);
      expect(result.containers?.[0]?.content).toHaveLength(1);
    }

    // One desktop and one mobile leg per locale: the locale is part of the
    // cache key, so no entry answered for another language.
    expect(mockAreaGet).toHaveBeenCalledTimes(LOCALES.length * 2);
  });

  it('still falls through to published content when preview has none', async () => {
    previewCookieMock.mockReturnValue(true);
    currentLocale = 'de-DE';
    mockAreaGet.mockImplementation(async (vars: Record<string, unknown>) =>
      vars.preview ? EMPTY_SHELL : POPULATED,
    );

    const result = await getContentArea(AREA, mockEvent());

    expect(result.containers?.[0]?.content).toHaveLength(1);
    expect(languageIdsSent()).toEqual(['de-DE', 'de-DE', 'de-DE', 'de-DE']);
  });
});
