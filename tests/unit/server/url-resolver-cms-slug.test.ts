import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the entity-resolver services so they are controllable and we can
// assert whether the semantic-slug branch skips them.
const mockGetProduct = vi.fn();
const mockGetCategoryPage = vi.fn();
const mockGetBrandPage = vi.fn();
const mockGetPageLinkByTag = vi.fn();
const mockGraphqlQuery = vi.fn();

vi.mock('../../../server/services/products', () => ({
  getProduct: (...args: unknown[]) => mockGetProduct(...args),
}));

vi.mock('../../../server/services/product-lists', () => ({
  getCategoryPage: (...args: unknown[]) => mockGetCategoryPage(...args),
  getBrandPage: (...args: unknown[]) => mockGetBrandPage(...args),
}));

// The CMS service is do-not-touch; mock it at the module boundary so the
// unit test does not reach the real SDK/network.
vi.mock('../../../server/services/cms', () => ({
  getPageLinkByTag: (...args: unknown[]) => mockGetPageLinkByTag(...args),
}));

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: { graphql: { query: mockGraphqlQuery } },
  }),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn().mockReturnValue('query urlHistory'),
}));

// wrapServiceCall is a Nitro auto-import; stub globally so the service module
// resolves it without the Nitro runtime.
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let resolver: typeof import('../../../server/services/url-resolver');

/**
 * Build a minimal H3Event-shaped object for tests. The semantic-slug branch
 * forwards the event unchanged to getPageLinkByTag, which uses
 * event.context.resolvedLocaleMarket internally. We expose that field here so
 * per-locale tests can assert the event is forwarded as-is.
 */
function makeEvent(
  resolvedLocaleMarket?: { market: string; locale: string },
): H3Event {
  return {
    context: {
      tenant: { tenantId: 't1', hostname: 'test.example.com' },
      ...(resolvedLocaleMarket ? { resolvedLocaleMarket } : {}),
    },
  } as unknown as H3Event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveEntityUrl: semantic CMS-slug branch', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: all entity lookups and urlHistory miss.
    mockGetProduct.mockResolvedValue(null);
    mockGetCategoryPage.mockResolvedValue(null);
    mockGetBrandPage.mockResolvedValue(null);
    mockGetPageLinkByTag.mockResolvedValue(null);
    mockGraphqlQuery.mockResolvedValue({ urlHistory: null });
    vi.resetModules();
    resolver = await import('../../../server/services/url-resolver');
  });

  // -------------------------------------------------------------------------
  // Happy path: known semantic slugs redirect to localized CMS page paths
  // -------------------------------------------------------------------------

  it('returns { redirect } for alias "terms" when a tagged terms page exists at "/villkor"', async () => {
    mockGetPageLinkByTag.mockResolvedValue('/villkor');

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/terms', alias: 'terms' },
      makeEvent(),
    );

    expect(result).toEqual({ redirect: '/villkor' });
    // The entity lookups must NOT have been called: the semantic branch returns
    // early before the Promise.allSettled block.
    expect(mockGetProduct).not.toHaveBeenCalled();
    expect(mockGetCategoryPage).not.toHaveBeenCalled();
    expect(mockGetBrandPage).not.toHaveBeenCalled();
    // urlHistory must also be skipped.
    expect(mockGraphqlQuery).not.toHaveBeenCalled();
  });

  it('resolves alias "contact-form" via CONTACT_PAGE tag and returns { redirect }', async () => {
    mockGetPageLinkByTag.mockResolvedValue('/kontakt');

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/contact-form', alias: 'contact-form' },
      makeEvent(),
    );

    expect(result).toEqual({ redirect: '/kontakt' });
    expect(mockGetProduct).not.toHaveBeenCalled();
  });

  it('resolves alias "apply-for-account" via APPLY_PAGE tag and returns { redirect }', async () => {
    mockGetPageLinkByTag.mockResolvedValue('/ansok');

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/apply-for-account', alias: 'apply-for-account' },
      makeEvent(),
    );

    expect(result).toEqual({ redirect: '/ansok' });
    expect(mockGetProduct).not.toHaveBeenCalled();
  });

  it('resolves alias "contact" via CONTACT_PAGE tag and returns { redirect }', async () => {
    mockGetPageLinkByTag.mockResolvedValue('/kontakt');

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/contact', alias: 'contact' },
      makeEvent(),
    );

    expect(result).toEqual({ redirect: '/kontakt' });
    expect(mockGetProduct).not.toHaveBeenCalled();
  });

  it('resolves alias "apply" via APPLY_PAGE tag and returns { redirect }', async () => {
    mockGetPageLinkByTag.mockResolvedValue('/ansok');

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/apply', alias: 'apply' },
      makeEvent(),
    );

    expect(result).toEqual({ redirect: '/ansok' });
    expect(mockGetProduct).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Fall-through: getPageLinkByTag returns null -> entity/urlHistory still run
  // -------------------------------------------------------------------------

  it('falls through to entity lookups when getPageLinkByTag returns null for a semantic alias', async () => {
    mockGetPageLinkByTag.mockResolvedValue(null);
    mockGetProduct.mockResolvedValue({
      canonicalUrl: '/se/sv/material/terms-product',
    });

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/terms', alias: 'terms' },
      makeEvent(),
    );

    // Entity lookup ran and resolved a product.
    expect(result).toMatchObject({ type: 'product' });
    expect(mockGetProduct).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Loop-safety: resolved clean path equals incoming clean path -> null
  // -------------------------------------------------------------------------

  it('returns null (no self-redirect) when the resolved path equals the incoming clean path', async () => {
    // Tenant whose terms page alias is literally "terms" -> getPageLinkByTag
    // returns "/terms", same as the incoming slug.
    mockGetPageLinkByTag.mockResolvedValue('/terms');
    // Entity lookups also miss so the terminal result is null.
    mockGetProduct.mockResolvedValue(null);
    mockGetCategoryPage.mockResolvedValue(null);
    mockGetBrandPage.mockResolvedValue(null);
    mockGraphqlQuery.mockResolvedValue({ urlHistory: null });

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/terms', alias: 'terms' },
      makeEvent(),
    );

    // Must not redirect to itself; the branch falls through so entity/urlHistory
    // are tried and then null is the final answer.
    expect(result).toBeNull();
  });

  it('falls through (no loop) when getPageLinkByTag returns a Geins-prefixed path equal to the incoming clean path', async () => {
    // The link carries a locale/market prefix; after stripping, the clean form
    // equals the incoming clean path -> treat as loop, fall through.
    mockGetPageLinkByTag.mockResolvedValue('/se/sv/terms');

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/terms', alias: 'terms' },
      makeEvent(),
    );

    // No redirect to self; final null because entity/urlHistory also miss.
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Non-semantic alias: branch is completely skipped
  // -------------------------------------------------------------------------

  it('skips the semantic branch for a non-semantic alias ("grenror") and runs entity lookups', async () => {
    mockGetProduct.mockResolvedValue({
      canonicalUrl: '/se/sv/material/grenror/grenror-150-150-88',
    });

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/grenror', alias: 'grenror' },
      makeEvent(),
    );

    // getPageLinkByTag must NOT have been called for a non-semantic alias.
    expect(mockGetPageLinkByTag).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: 'product' });
  });

  it('skips the semantic branch for an empty alias', async () => {
    await resolver.resolveEntityUrl(
      { path: '/', alias: '' },
      makeEvent(),
    );

    expect(mockGetPageLinkByTag).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Error resilience: getPageLinkByTag throws -> fall through, never breaks
  // -------------------------------------------------------------------------

  it('falls through gracefully when getPageLinkByTag throws (CMS error does not break recovery)', async () => {
    mockGetPageLinkByTag.mockRejectedValue(new Error('CMS timeout'));
    mockGetProduct.mockResolvedValue({
      canonicalUrl: '/se/sv/material/terms-product',
    });

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/terms', alias: 'terms' },
      makeEvent(),
    );

    // Entity lookup ran normally despite the CMS error.
    expect(result).toMatchObject({ type: 'product' });
    expect(mockGetProduct).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Open-redirect guard: unsafe link from getPageLinkByTag must fall through
  // -------------------------------------------------------------------------

  it('falls through instead of redirecting when getPageLinkByTag returns a protocol-relative unsafe link', async () => {
    // A malformed or injected unsafe path must never surface as a redirect.
    mockGetPageLinkByTag.mockResolvedValue('//evil.com/phish');

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/terms', alias: 'terms' },
      makeEvent(),
    );

    // Safe guard rejected the link; no redirect emitted.
    expect(result).toBeNull();
    // Entity lookups ran (fell through).
    expect(mockGetProduct).toHaveBeenCalled();
  });

  it('falls through for an absolute-https unsafe link from getPageLinkByTag', async () => {
    mockGetPageLinkByTag.mockResolvedValue('https://evil.com/terms');

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/terms', alias: 'terms' },
      makeEvent(),
    );

    expect(result).toBeNull();
    expect(mockGetProduct).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Per-locale: getPageLinkByTag is called with the forwarded event so
  // resolvedLocaleMarket on the event drives localization correctly.
  // -------------------------------------------------------------------------

  it('forwards the event (with resolvedLocaleMarket) to getPageLinkByTag for per-locale resolution', async () => {
    mockGetPageLinkByTag.mockResolvedValue('/terms-en');
    const event = makeEvent({ market: 'se', locale: 'en' });

    const result = await resolver.resolveEntityUrl(
      { path: '/se/en/terms', alias: 'terms' },
      event,
    );

    // getPageLinkByTag received the exact same event object.
    expect(mockGetPageLinkByTag).toHaveBeenCalledWith(
      expect.objectContaining({ tag: expect.any(String) }),
      event,
    );
    // And the tag passed is the CMS_TAGS value for 'terms'.
    const callArgs = mockGetPageLinkByTag.mock.calls[0] as [
      { tag: string },
      H3Event,
    ];
    expect(callArgs[0].tag).toBe('terms');
    expect(result).toEqual({ redirect: '/terms-en' });
  });

  // -------------------------------------------------------------------------
  // Edge case: Geins-prefixed link with different clean path redirects correctly
  // -------------------------------------------------------------------------

  it('redirects when getPageLinkByTag returns a Geins-prefixed path different from the incoming clean path', async () => {
    // getPageLinkByTag may return a fully-prefixed path; the clean form
    // "/villkor" differs from "/terms", so a redirect is correct.
    mockGetPageLinkByTag.mockResolvedValue('/se/sv/villkor');

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/terms', alias: 'terms' },
      makeEvent(),
    );

    expect(result).toEqual({ redirect: '/se/sv/villkor' });
    expect(mockGetProduct).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Existing entity recovery is unaffected by the new branch
  // -------------------------------------------------------------------------

  it('does not interfere with normal product alias recovery (semantic branch is no-op for product aliases)', async () => {
    mockGetProduct.mockResolvedValue({
      canonicalUrl: '/se/sv/material/grenror/grenror-150-150-88',
    });

    const result = await resolver.resolveEntityUrl(
      { path: '/se/sv/grenror-150-150-88', alias: 'grenror-150-150-88' },
      makeEvent(),
    );

    expect(mockGetPageLinkByTag).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      type: 'product',
      canonicalAppPath: '/se/sv/p/material/grenror/grenror-150-150-88',
    });
  });
});
