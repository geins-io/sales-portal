import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

const mockReadPreviewPageDraft = vi.fn();
vi.mock('../../../server/services/cms', () => ({
  readPreviewPageDraft: (...args: unknown[]) =>
    mockReadPreviewPageDraft(...args),
}));

const { previewLandingPath } =
  await import('../../../server/utils/preview-landing');

const event = {} as H3Event;
const PAGE_DRAFT = { id: '33', title: 'Test page draft', containers: [{}] };

describe('previewLandingPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadPreviewPageDraft.mockResolvedValue(PAGE_DRAFT);
  });

  it('lands a page draft on its alias under the start page it was sent to', async () => {
    expect(await previewLandingPath(event, 'jwt', '/se/sv/')).toBe(
      '/se/sv/test-page-draft',
    );
    expect(await previewLandingPath(event, 'jwt', '/se/sv')).toBe(
      '/se/sv/test-page-draft',
    );
    expect(mockReadPreviewPageDraft).toHaveBeenCalledWith(
      event,
      'jwt',
      '/se/sv/',
    );
  });

  it('keeps the path when the token carries no page draft', async () => {
    mockReadPreviewPageDraft.mockResolvedValue(null);

    expect(await previewLandingPath(event, 'jwt', '/se/sv/')).toBe('/se/sv/');
  });

  it('keeps the path when the draft title gives no alias', async () => {
    for (const title of ['', 'Привет мир', '日本語']) {
      mockReadPreviewPageDraft.mockResolvedValue({ ...PAGE_DRAFT, title });

      expect(await previewLandingPath(event, 'jwt', '/se/sv/')).toBe('/se/sv/');
      expect(await previewLandingPath(event, 'jwt', '/se/sv')).toBe('/se/sv');
    }
  });

  it('joins the alias with one slash after any number of trailing slashes', async () => {
    expect(await previewLandingPath(event, 'jwt', '/se/sv//')).toBe(
      '/se/sv/test-page-draft',
    );
  });

  it('lands a title with letters that do not decompose on the alias getPage matches', async () => {
    // ø, æ, ß and ł have no base letter to strip to, so they become dashes.
    mockReadPreviewPageDraft.mockResolvedValue({
      ...PAGE_DRAFT,
      title: 'Smørbrød på Øland',
    });

    expect(await previewLandingPath(event, 'jwt', '/dk/da/')).toBe(
      '/dk/da/sm-rbr-d-pa-land',
    );
  });

  it('keeps the path when the read throws', async () => {
    mockReadPreviewPageDraft.mockRejectedValue(new Error('timed out'));

    expect(await previewLandingPath(event, 'jwt', '/se/sv/')).toBe('/se/sv/');
  });

  it('keeps a bare / , where a two-letter alias would read as a market prefix', async () => {
    mockReadPreviewPageDraft.mockResolvedValue({ ...PAGE_DRAFT, title: 'Om' });

    expect(await previewLandingPath(event, 'jwt', '/')).toBe('/');
    expect(
      await previewLandingPath(event, 'jwt', '/preview-widgets', '/'),
    ).toBe('/preview-widgets');
    expect(mockReadPreviewPageDraft).not.toHaveBeenCalled();
  });

  it('lands a two-letter alias under its prefix', async () => {
    mockReadPreviewPageDraft.mockResolvedValue({ ...PAGE_DRAFT, title: 'Om' });

    expect(await previewLandingPath(event, 'jwt', '/se/sv/')).toBe('/se/sv/om');
  });

  it('never moves a path that is not a start page, and reads nothing for it', async () => {
    expect(await previewLandingPath(event, 'jwt', '/preview-widgets')).toBe(
      '/preview-widgets',
    );
    expect(await previewLandingPath(event, 'jwt', '/se/sv/c/kablar')).toBe(
      '/se/sv/c/kablar',
    );
    expect(mockReadPreviewPageDraft).not.toHaveBeenCalled();
  });

  // Merchant Center links a page draft without `redirect=true`, so the preview
  // is sent to the status page; the page passes the start page it would link.
  describe('sent to the preview status page', () => {
    it('lands a page draft on its alias under the given start page', async () => {
      expect(
        await previewLandingPath(event, 'jwt', '/preview-widgets', '/se/sv/'),
      ).toBe('/se/sv/test-page-draft');
      expect(mockReadPreviewPageDraft).toHaveBeenCalledWith(
        event,
        'jwt',
        '/se/sv/',
      );
    });

    it('keeps the status page for an area draft, no draft, an empty alias or a failed read', async () => {
      mockReadPreviewPageDraft.mockResolvedValueOnce(null);
      mockReadPreviewPageDraft.mockResolvedValueOnce({
        ...PAGE_DRAFT,
        title: 'Привет',
      });
      mockReadPreviewPageDraft.mockRejectedValueOnce(new Error('timed out'));

      for (let i = 0; i < 3; i++) {
        expect(
          await previewLandingPath(event, 'jwt', '/preview-widgets', '/se/sv/'),
        ).toBe('/preview-widgets');
      }
    });

    it.each([
      undefined,
      '',
      'https://evil.example/se/sv/',
      '//evil.example/',
      '/\\evil.example/',
      '/se/sv/../x',
      '/se/sv/c/kablar',
      '/se/sv/?x=1',
      '/SE/sv/',
    ])('ignores home %j and keeps the status page', async (home) => {
      expect(
        await previewLandingPath(event, 'jwt', '/preview-widgets', home),
      ).toBe('/preview-widgets');
      expect(mockReadPreviewPageDraft).not.toHaveBeenCalled();
    });

    it('uses home only for the status page, never for another path', async () => {
      expect(
        await previewLandingPath(event, 'jwt', '/se/sv/c/kablar', '/se/sv/'),
      ).toBe('/se/sv/c/kablar');
      expect(mockReadPreviewPageDraft).not.toHaveBeenCalled();
    });
  });
});
