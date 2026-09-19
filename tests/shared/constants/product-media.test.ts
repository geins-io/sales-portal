import { describe, it, expect } from 'vitest';
import {
  classifyMediaParameter,
  resolveVideoEmbedUrl,
  PRODUCT_MEDIA_PARAMETER_DEFAULTS,
} from '../../../shared/constants/product-media';

describe('classifyMediaParameter', () => {
  it('keys on identifier, so a localized display name still classifies', () => {
    // `name` is the display string and changes per language; `identifier` is
    // documented by Geins as the same across every language. Classifying on
    // the name would work in the default locale and stop in all the others.
    const result = classifyMediaParameter({
      identifier: 'videourl',
      name: 'Produktvideo',
      value: 'https://www.youtube.com/watch?v=abc123',
    });
    expect(result[0]?.kind).toBe('video');
  });

  it('falls back to name when the parameter carries no identifier', () => {
    const result = classifyMediaParameter({
      name: 'VideoURL',
      value: 'https://www.youtube.com/watch?v=abc123',
    });
    expect(result[0]?.kind).toBe('video');
  });

  it('matches a tenant table key whatever case the merchant typed it in', () => {
    // The merchant admin stores the key verbatim, so the documented
    // `{"Datasheet": "document"}` has to match a `datasheet` parameter.
    const result = classifyMediaParameter(
      { identifier: 'datasheet', value: 'https://cdn.example.com/d.pdf' },
      { Datasheet: 'document' },
    );
    expect(result[0]?.kind).toBe('document');
  });

  it('lets a mixed-case tenant override replace the default for that key', () => {
    // `Manual` and `manual` must be the same entry, not two.
    const result = classifyMediaParameter(
      { identifier: 'manual', value: 'https://cdn.example.com/m.mp4' },
      { ...PRODUCT_MEDIA_PARAMETER_DEFAULTS, Manual: 'video' },
    );
    expect(result[0]?.kind).toBe('video');
  });

  it('classifies a known name against the default table when no table is passed', () => {
    const result = classifyMediaParameter({
      name: 'VideoURL',
      value: 'https://www.youtube.com/watch?v=abc123',
    });
    expect(result[0]?.kind).toBe('video');
  });

  it("uses a tenant's own table instead of the defaults when one is passed", () => {
    const tenantTable = { producturl: 'video' as const };

    // "VideoURL" isn't in this tenant's table, so the default match doesn't apply.
    expect(
      classifyMediaParameter(
        { name: 'VideoURL', value: 'https://cdn.example.com/vid.mp4' },
        tenantTable,
      ),
    ).toEqual([]);

    // "ProductURL" is this tenant's own name for the same concept.
    const result = classifyMediaParameter(
      { name: 'ProductURL', value: 'https://cdn.example.com/vid.mp4' },
      tenantTable,
    );
    expect(result[0]?.kind).toBe('video');
  });

  it("lets a tenant extend the defaults with a name their PIM uses instead (e.g. 'Datasheet' instead of 'Manual')", () => {
    const tenantTable = {
      ...PRODUCT_MEDIA_PARAMETER_DEFAULTS,
      datasheet: 'document' as const,
    };

    const extended = classifyMediaParameter(
      { name: 'Datasheet', value: 'https://cdn.example.com/spec.pdf' },
      tenantTable,
    );
    expect(extended[0]?.kind).toBe('document');

    // The defaults this tenant didn't override still work.
    const stillDefault = classifyMediaParameter(
      { name: 'Manual', value: 'https://cdn.example.com/manual.pdf' },
      tenantTable,
    );
    expect(stillDefault[0]?.kind).toBe('document');
  });

  it('still requires a URL-shaped value even with a custom table', () => {
    const tenantTable = { datasheet: 'document' as const };
    const result = classifyMediaParameter(
      { name: 'Datasheet', value: 'Contact sales for the datasheet' },
      tenantTable,
    );
    expect(result).toEqual([]);
  });

  it('respects exactly the table it is given, with no hidden fallback to the defaults', () => {
    // In practice server/utils/tenant.ts always merges PRODUCT_MEDIA_PARAMETER_DEFAULTS
    // under a tenant's own table before this function ever sees it, so a
    // real tenant can't reach an empty table — this confirms the function
    // itself doesn't quietly reintroduce the defaults if a caller ever did
    // pass one.
    const result = classifyMediaParameter(
      { name: 'VideoURL', value: 'https://www.youtube.com/watch?v=abc123' },
      {},
    );
    expect(result).toEqual([]);
  });
});

describe('classifyMediaParameter — multi-value parameters', () => {
  it('splits a pipe-delimited value into one entry per URL', () => {
    const result = classifyMediaParameter({
      name: 'Manual',
      value:
        'https://cdn.example.com/manual-en.pdf|https://cdn.example.com/manual-sv.pdf',
    });
    expect(result.map((m) => m.url)).toEqual([
      'https://cdn.example.com/manual-en.pdf',
      'https://cdn.example.com/manual-sv.pdf',
    ]);
    expect(result.every((m) => m.kind === 'document')).toBe(true);
  });

  it('returns exactly one entry for a single URL', () => {
    const result = classifyMediaParameter({
      name: 'Manual',
      value: 'https://cdn.example.com/manual.pdf',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe('https://cdn.example.com/manual.pdf');
  });

  it('returns an empty array for an unmapped name', () => {
    const result = classifyMediaParameter({
      name: 'Weight',
      value: 'https://cdn.example.com/thing.pdf',
    });
    expect(result).toEqual([]);
  });

  it('returns an empty array when no piece is a usable URL', () => {
    const result = classifyMediaParameter({
      name: 'Manual',
      value: 'Contact sales|ask your rep',
    });
    expect(result).toEqual([]);
  });

  it('keeps the valid pieces and drops the invalid ones', () => {
    const result = classifyMediaParameter({
      name: 'Manual',
      value:
        'https://cdn.example.com/good.pdf|not-a-url|https://cdn.example.com/also-good.pdf',
    });
    expect(result.map((m) => m.url)).toEqual([
      'https://cdn.example.com/good.pdf',
      'https://cdn.example.com/also-good.pdf',
    ]);
  });

  it('trims whitespace around pieces and drops empty segments', () => {
    const result = classifyMediaParameter({
      name: 'Manual',
      value:
        ' https://cdn.example.com/a.pdf || https://cdn.example.com/b.pdf |',
    });
    expect(result.map((m) => m.url)).toEqual([
      'https://cdn.example.com/a.pdf',
      'https://cdn.example.com/b.pdf',
    ]);
  });

  it('resolves embedUrl independently per entry', () => {
    const result = classifyMediaParameter({
      name: 'VideoURL',
      value:
        'https://www.youtube.com/watch?v=abc123|https://cdn.example.com/clip.mp4',
    });
    expect(result[0]?.embedUrl).toBe('https://www.youtube.com/embed/abc123');
    // A direct file has no embed URL — callers render it with <video>.
    expect(result[1]?.embedUrl).toBeNull();
  });

  it('gives every entry from one parameter the same label', () => {
    const result = classifyMediaParameter({
      name: 'ProductSpec',
      value: 'https://cdn.example.com/a.pdf|https://cdn.example.com/b.pdf',
    });
    expect(result.map((m) => m.label)).toEqual([
      'Product Spec',
      'Product Spec',
    ]);
  });
});

describe('resolveVideoEmbedUrl', () => {
  it('embeds a YouTube Shorts URL', () => {
    expect(
      resolveVideoEmbedUrl('https://www.youtube.com/shorts/Xz4Taqin0Io'),
    ).toBe('https://www.youtube.com/embed/Xz4Taqin0Io');
  });

  it('embeds the other YouTube and Vimeo forms', () => {
    expect(resolveVideoEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe(
      'https://www.youtube.com/embed/abc123',
    );
    expect(resolveVideoEmbedUrl('https://youtu.be/abc123')).toBe(
      'https://www.youtube.com/embed/abc123',
    );
    expect(resolveVideoEmbedUrl('https://vimeo.com/123456')).toBe(
      'https://player.vimeo.com/video/123456',
    );
  });

  it('returns null for a URL it does not recognize', () => {
    expect(resolveVideoEmbedUrl('https://cdn.example.com/clip.mp4')).toBeNull();
    expect(resolveVideoEmbedUrl('https://www.loom.com/share/abc')).toBeNull();
  });
});

describe('classifyMediaParameter — how each entry should be displayed', () => {
  it('marks a recognized provider URL as embeddable', () => {
    const [entry] = classifyMediaParameter({
      name: 'VideoURL',
      value: 'https://www.youtube.com/shorts/Xz4Taqin0Io',
    });
    expect(entry?.display).toBe('embed');
    expect(entry?.embedUrl).toBe('https://www.youtube.com/embed/Xz4Taqin0Io');
  });

  it('marks a direct video file as playable in a video element', () => {
    const [entry] = classifyMediaParameter({
      name: 'VideoURL',
      value: 'https://cdn.example.com/clip.mp4',
    });
    expect(entry?.display).toBe('file');
    expect(entry?.embedUrl).toBeNull();
  });

  it('sees through a query string when detecting a direct video file', () => {
    const [entry] = classifyMediaParameter({
      name: 'VideoURL',
      value: 'https://cdn.example.com/clip.mp4?token=abc123',
    });
    expect(entry?.display).toBe('file');
  });

  it('falls back to a link for a video URL that is neither embeddable nor a file', () => {
    // A page URL on a provider we do not recognize. Rendering this in a
    // <video> element shows a player that can never play anything, so it
    // has to degrade to a link the shopper can actually follow.
    const [entry] = classifyMediaParameter({
      name: 'VideoURL',
      value: 'https://www.loom.com/share/abc123',
    });
    expect(entry?.display).toBe('link');
    expect(entry?.embedUrl).toBeNull();
  });

  it('always displays documents as links', () => {
    const [pdf] = classifyMediaParameter({
      name: 'Manual',
      value: 'https://cdn.example.com/manual.pdf',
    });
    expect(pdf?.display).toBe('link');

    // Even when the document URL happens to be a known video provider, the
    // mapped kind decides the tab it lands in; a link is always safe.
    const [page] = classifyMediaParameter({
      name: 'Manual',
      value: 'https://www.youtube.com/watch?v=abc123',
    });
    expect(page?.display).toBe('link');
  });
});

describe('classifyMediaParameter — file type', () => {
  const fileTypeOf = (value: string, name = 'Manual') =>
    classifyMediaParameter({ name, value })[0]?.fileType;

  it('derives the format from the extension', () => {
    expect(fileTypeOf('https://x.example/a.pdf')).toBe('pdf');
    expect(fileTypeOf('https://x.example/a.docx')).toBe('text');
    expect(fileTypeOf('https://x.example/a.xlsx')).toBe('spreadsheet');
    expect(fileTypeOf('https://x.example/a.csv')).toBe('spreadsheet');
    expect(fileTypeOf('https://x.example/a.zip')).toBe('archive');
    expect(fileTypeOf('https://x.example/a.png')).toBe('image');
    expect(fileTypeOf('https://x.example/a.mp3')).toBe('audio');
    expect(fileTypeOf('https://x.example/a.dwg')).toBe('cad');
    expect(fileTypeOf('https://x.example/a.step')).toBe('cad');
    expect(fileTypeOf('https://x.example/a.json')).toBe('code');
    expect(fileTypeOf('https://x.example/clip.mp4', 'VideoURL')).toBe('video');
  });

  it('matches the extension case-insensitively', () => {
    expect(fileTypeOf('https://x.example/MANUAL.PDF')).toBe('pdf');
  });

  it('sees through a query string or fragment', () => {
    expect(fileTypeOf('https://x.example/a.pdf?token=abc')).toBe('pdf');
    expect(fileTypeOf('https://x.example/a.pdf#page=2')).toBe('pdf');
  });

  it('is null for a URL with no recognizable file extension', () => {
    // Nothing to download — these open a page, which the UI should signal
    // differently from a file.
    expect(
      fileTypeOf('https://sharepoint.example/sites/docs/Manual.aspx'),
    ).toBeNull();
    expect(fileTypeOf('https://x.example/downloads/12345')).toBeNull();
    expect(fileTypeOf('https://x.example/')).toBeNull();
  });
});

describe('classifyMediaParameter — file name', () => {
  const fileNameOf = (value: string, name = 'Manual') =>
    classifyMediaParameter({ name, value })[0]?.fileName;

  it('exposes the file name so several files under one parameter can be told apart', () => {
    // The label comes from the parameter, so every entry of a multi-value
    // parameter shares it; the file name is the only per-entry identity.
    const entries = classifyMediaParameter({
      name: 'Manual',
      value: 'https://x.example/5590_1.pdf|https://x.example/5590_2.pdf',
    });
    expect(entries.map((e) => e.label)).toEqual(['Manual', 'Manual']);
    expect(entries.map((e) => e.fileName)).toEqual([
      '5590_1.pdf',
      '5590_2.pdf',
    ]);
  });

  it('takes the last path segment, ignoring query and fragment', () => {
    expect(fileNameOf('https://x.example/files/manual-sv.pdf?token=abc')).toBe(
      'manual-sv.pdf',
    );
    expect(fileNameOf('https://x.example/files/manual-sv.pdf#page=2')).toBe(
      'manual-sv.pdf',
    );
  });

  it('decodes a percent-encoded name', () => {
    expect(fileNameOf('https://x.example/Installations%20manual.pdf')).toBe(
      'Installations manual.pdf',
    );
  });

  it('is null when the URL has no file name to show', () => {
    // A page rather than a file: there is nothing meaningful to display.
    expect(fileNameOf('https://x.example/downloads/12345')).toBeNull();
    expect(fileNameOf('https://x.example/')).toBeNull();
    expect(
      fileNameOf('https://www.youtube.com/watch?v=abc123', 'VideoURL'),
    ).toBeNull();
  });
});

describe('a URL with no path', () => {
  it('does not read the host TLD as a file extension', () => {
    // https://demo.mov is a web page on a .mov domain, not a video file.
    // Treating it as one renders a <video> element pointed at HTML.
    const [entry] = classifyMediaParameter({
      identifier: 'videourl',
      value: 'https://demo.mov',
    });
    expect(entry?.display).not.toBe('file');
    expect(entry?.fileName).toBeNull();
  });

  it('still resolves a real file path on the same kind of host', () => {
    const [entry] = classifyMediaParameter({
      identifier: 'manual',
      value: 'https://cdn.example.com/docs/manual.pdf',
    });
    expect(entry?.fileType).toBe('pdf');
    expect(entry?.fileName).toBe('manual.pdf');
  });
});

describe('resolveVideoEmbedUrl host anchoring', () => {
  it('embeds the real providers', () => {
    expect(resolveVideoEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe(
      'https://www.youtube.com/embed/abc123',
    );
    expect(resolveVideoEmbedUrl('https://youtu.be/abc123')).toBe(
      'https://www.youtube.com/embed/abc123',
    );
    expect(resolveVideoEmbedUrl('https://vimeo.com/12345')).toBe(
      'https://player.vimeo.com/video/12345',
    );
  });

  it('refuses a lookalike host that merely contains the provider name', () => {
    // `youtube.com/watch?v=` occurs inside `evil-youtube.com/watch?v=`, so an
    // unanchored substring test presents an unrelated host's link as though
    // the provider vouched for it.
    expect(
      resolveVideoEmbedUrl('https://evil-youtube.com/watch?v=abc123'),
    ).toBeNull();
    expect(resolveVideoEmbedUrl('https://notvimeo.com/12345')).toBeNull();
    expect(
      resolveVideoEmbedUrl('https://example.com/youtube.com/watch?v=abc'),
    ).toBeNull();
  });
});
