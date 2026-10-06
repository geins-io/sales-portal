import { describe, it, expect, vi, assert } from 'vitest';
import type {
  ContentPageType,
  ContentAreaType,
  ContentType,
  ContentConfigType,
} from '@geins/types';
import type { CmsContentArea, CmsContentContainer } from '#shared/types/cms';

import {
  sanitizeWidgetHtml,
  sanitizeCmsPage,
  sanitizeCmsArea,
} from '../../server/utils/cms-sanitize';

vi.mock('../../server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createTenantLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// --- Helpers ---

function makeConfig(
  overrides: Partial<ContentConfigType> = {},
): ContentConfigType {
  return {
    name: 'w1',
    displayName: 'Widget 1',
    active: true,
    type: 'TextPageWidget',
    size: 'full',
    sortOrder: 0,
    ...overrides,
  };
}

/** The data of the first widget in the first container of a sanitized result. */
function firstWidgetData(
  result: ContentPageType | ContentAreaType,
): Record<string, unknown> {
  const container = result.containers[0];
  assert.isDefined(container);
  const widget = container.content[0];
  assert.isDefined(widget);
  return widget.data as Record<string, unknown>;
}

function makeWidget(type: string, data: Record<string, unknown>): ContentType {
  return {
    config: makeConfig({ type }),
    data,
  };
}

function makeContainer(
  content: ContentType[],
  overrides: Partial<CmsContentContainer> = {},
): CmsContentContainer {
  return {
    id: '1',
    name: 'c1',
    sortOrder: 0,
    layout: 'full',
    responsiveMode: 'default',
    design: 'default',
    content,
    ...overrides,
  };
}

// --- Tests ---

describe('sanitizeWidgetHtml', () => {
  it('strips <script> tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeWidgetHtml(input);
    expect(result).not.toContain('<script');
    expect(result).toContain('<p>Hello</p>');
  });

  it('strips <iframe> tags', () => {
    const input = '<p>Safe</p><iframe src="https://evil.com"></iframe>';
    const result = sanitizeWidgetHtml(input);
    expect(result).not.toContain('<iframe');
    expect(result).toContain('<p>Safe</p>');
  });

  it('preserves safe HTML (p, a, strong, em, img)', () => {
    const input =
      '<p>Text <strong>bold</strong> <em>italic</em> <a href="/link">link</a> <img src="pic.jpg" alt="pic"></p>';
    const result = sanitizeWidgetHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<a href="/link">link</a>');
    expect(result).toContain('<img src="pic.jpg" alt="pic" />');
  });

  it('strips event handlers (onclick, onerror)', () => {
    const input =
      '<p onclick="alert(1)">click</p><img src="x" onerror="alert(2)">';
    const result = sanitizeWidgetHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onerror');
    expect(result).toContain('<p>click</p>');
  });

  it.each([
    'p',
    'strong',
    'em',
    'b',
    'i',
    'u',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'div',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'blockquote',
    'figure',
    'figcaption',
    'sup',
    'sub',
    'small',
    'pre',
    'code',
  ])('keeps <%s>', (tag) => {
    expect(sanitizeWidgetHtml(`<${tag}>x</${tag}>`)).toBe(`<${tag}>x</${tag}>`);
  });

  it.each(['br', 'hr', 'img'])('keeps void <%s>', (tag) => {
    expect(sanitizeWidgetHtml(`<${tag}>`)).toBe(`<${tag} />`);
  });

  it.each([
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'title',
    'class',
    'id',
    'style',
    'width',
    'height',
    'colspan',
    'rowspan',
  ])('keeps the %s attribute', (attr) => {
    expect(sanitizeWidgetHtml(`<td ${attr}="v">x</td>`)).toBe(
      `<td ${attr}="v">x</td>`,
    );
  });

  it('passes the style attribute through verbatim', () => {
    const result = sanitizeWidgetHtml(
      '<p style="color:red; margin: 0 4px">styled</p>',
    );
    expect(result).toContain('style="color:red; margin: 0 4px"');
  });

  it('keeps data:image sources on img', () => {
    const result = sanitizeWidgetHtml(
      '<img src="data:image/png;base64,AAAA" alt="inline">',
    );
    expect(result).toContain('src="data:image/png;base64,AAAA"');
  });

  it.each([
    'https://example.test/',
    'http://example.test/',
    'mailto:sales@example.test',
    'tel:+4612345',
    'ftp://example.test/file',
    'ftps://example.test/file',
    'sms:+4612345',
    'callto:sales',
    'cid:part1',
    'xmpp:sales@example.test',
    'matrix:u/sales:example.test',
    '/link',
    '#top',
    '?q=1',
    '//cdn.example.test/file',
    'page.html',
  ])('keeps href %s', (href) => {
    const result = sanitizeWidgetHtml(`<a href="${href}">link</a>`);
    expect(result).toContain(`href="${href}"`);
  });

  it.each([
    'javascript:alert(1)',
    '  JaVaScRiPt:alert(1)',
    'java&#x09;script:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,x',
    'file:///etc/passwd',
  ])('strips href %s', (href) => {
    const result = sanitizeWidgetHtml(`<a href="${href}">link</a>`);
    expect(result).not.toContain('href');
    expect(result).toContain('link');
  });

  it('keeps aria-* attributes and drops data-* attributes', () => {
    const result = sanitizeWidgetHtml(
      '<p aria-label="label" data-track="x">text</p>',
    );
    expect(result).toContain('aria-label="label"');
    expect(result).not.toContain('data-track');
  });

  it.each([
    'annotation-xml',
    'audio',
    'colgroup',
    'desc',
    'foreignobject',
    'head',
    'iframe',
    'math',
    'mi',
    'mn',
    'mo',
    'ms',
    'mtext',
    'noembed',
    'noframes',
    'noscript',
    'object',
    'plaintext',
    'script',
    'style',
    'svg',
    'template',
    'title',
    'video',
    'xmp',
  ])('drops the content of <%s>', (tag) => {
    const result = sanitizeWidgetHtml(
      `<p>ok</p><${tag}><p>secret</p></${tag}>`,
    );
    expect(result).not.toContain('secret');
    expect(result).toContain('<p>ok</p>');
  });

  it('drops object fallback text next to an embed', () => {
    const result = sanitizeWidgetHtml(
      '<p>ok</p><object data="movie.swf">secret</object><embed src="movie.swf">',
    );
    expect(result).toBe('<p>ok</p>');
  });

  it('keeps the text of other removed elements', () => {
    const result = sanitizeWidgetHtml(
      '<custom>custom</custom><textarea>area</textarea><select><option>choice</option></select><button>press</button>',
    );
    for (const text of ['custom', 'area', 'choice', 'press']) {
      expect(result).toContain(text);
    }
    expect(result).not.toMatch(/<(custom|textarea|select|option|button)/);
  });
});

describe('sanitizeCmsPage', () => {
  it('walks containers and sanitizes TextPageWidget .text field', () => {
    const page: ContentPageType = {
      id: 'page-1',
      name: 'Test Page',
      title: 'Test',
      meta: { title: 'Test', description: '' },
      tags: [],
      containers: [
        makeContainer([
          makeWidget('TextPageWidget', {
            text: '<p>Hello</p><script>alert("xss")</script>',
            name: 'w1',
            active: true,
          }),
        ]),
      ],
    };

    const result = sanitizeCmsPage(page);
    const data = firstWidgetData(result);
    expect(data.text).not.toContain('<script');
    expect(data.text).toContain('<p>Hello</p>');
  });

  it('sanitizes HTMLPageWidget .html and .css fields', () => {
    const page: ContentPageType = {
      id: 'page-2',
      name: 'HTML Page',
      title: 'HTML',
      meta: { title: 'HTML', description: '' },
      tags: [],
      containers: [
        makeContainer([
          makeWidget('HTMLPageWidget', {
            html: '<div><script>steal()</script><p>content</p></div>',
            css: 'body{color:red}<script>alert(1)</script>',
            name: 'w2',
            active: true,
          }),
        ]),
      ],
    };

    const result = sanitizeCmsPage(page);
    const data = firstWidgetData(result);
    expect(data.html).not.toContain('<script');
    expect(data.html).toContain('<p>content</p>');
    expect(data.css).not.toContain('<script');
    expect(data.css).toContain('body{color:red}');
  });

  it('handles empty containers array gracefully', () => {
    const page: ContentPageType = {
      meta: { title: '', description: '' },
      tags: [],
      containers: [],
    };

    const result = sanitizeCmsPage(page);
    expect(result.containers).toEqual([]);
  });
});

describe('sanitizeCmsArea', () => {
  it('walks containers and sanitizes widget data', () => {
    const area: ContentAreaType = {
      meta: { title: 'Hero', description: '' },
      tags: [],
      containers: [
        makeContainer([
          makeWidget('TextPageWidget', {
            text: '<p>Area text</p><script>xss()</script>',
            name: 'aw1',
            active: true,
          }),
        ]),
      ],
    };

    const result = sanitizeCmsArea(area);
    const data = firstWidgetData(result);
    expect(data.text).not.toContain('<script');
    expect(data.text).toContain('<p>Area text</p>');
  });

  it('handles empty containers array gracefully', () => {
    const area: ContentAreaType = {
      meta: { title: '', description: '' },
      tags: [],
      containers: [],
    };

    const result = sanitizeCmsArea(area);
    expect(result.containers).toEqual([]);
  });

  it('preserves the derived container visibility tag through sanitize', () => {
    // The visibility tag is attached by getContentArea after merging the two
    // display-setting legs. Sanitize must not strip it, or only-mobile blocks
    // lose their md:hidden class on the way to the client.
    const area: ContentAreaType = {
      meta: { title: 'Hero', description: '' },
      tags: [],
      containers: [
        makeContainer(
          [
            makeWidget('TextPageWidget', {
              text: '<p>x</p>',
              name: 'w',
              active: true,
            }),
          ],
          { id: 'section-02', visibility: 'mobile' },
        ),
      ],
    };

    const result = sanitizeCmsArea(area) as CmsContentArea;
    expect(result.containers[0]?.visibility).toBe('mobile');
  });
});

describe('sanitizeWidgetData guards', () => {
  function areaWith(content: ContentType[]): ContentAreaType {
    return {
      meta: { title: '', description: '' },
      tags: [],
      containers: [makeContainer(content)],
    };
  }

  function firstWidget(result: ContentAreaType): ContentType {
    const widget = result.containers[0]?.content[0];
    assert.isDefined(widget);
    return widget;
  }

  it('returns a widget without config unchanged', () => {
    const widget = {
      data: { text: '<script>x</script>' },
    } as unknown as ContentType;
    expect(firstWidget(sanitizeCmsArea(areaWith([widget])))).toBe(widget);
  });

  it('returns a widget without a type unchanged', () => {
    const widget: ContentType = {
      config: makeConfig({ type: '' }),
      data: { text: '<script>x</script>' },
    };
    expect(firstWidget(sanitizeCmsArea(areaWith([widget])))).toBe(widget);
  });

  it('returns a widget without data unchanged', () => {
    const widget = {
      config: makeConfig({ type: 'TextPageWidget' }),
    } as unknown as ContentType;
    expect(firstWidget(sanitizeCmsArea(areaWith([widget])))).toBe(widget);
  });

  it('leaves the fields of other widget types untouched', () => {
    const data = {
      text: '<script>x</script>',
      html: '<script>y</script>',
      css: '<script>z</script>',
    };
    const result = sanitizeCmsArea(
      areaWith([makeWidget('ImagePageWidget', data)]),
    );
    expect(firstWidget(result).data).toEqual(data);
  });

  it('only sanitizes the html field of an HTMLPageWidget, not its text', () => {
    const result = sanitizeCmsArea(
      areaWith([makeWidget('HTMLPageWidget', { text: '<script>x</script>' })]),
    );
    expect(firstWidget(result).data).toEqual({ text: '<script>x</script>' });
  });

  it('only sanitizes the text field of a TextPageWidget, not its html', () => {
    const result = sanitizeCmsArea(
      areaWith([makeWidget('TextPageWidget', { html: '<script>x</script>' })]),
    );
    expect(firstWidget(result).data).toEqual({ html: '<script>x</script>' });
  });

  describe('Rich text widget', () => {
    function richText(text: string): unknown {
      const result = sanitizeCmsArea(
        areaWith([makeWidget('Rich textPageWidget', { text })]),
      );
      return firstWidget(result).data.text;
    }

    it('removes <script> elements', () => {
      expect(richText('<p>Terms</p><script>steal()</script>')).toBe(
        '<p>Terms</p>',
      );
    });

    it('removes on* event handlers', () => {
      expect(
        richText(
          '<p onclick="steal()">Terms</p><img src="x.jpg" onerror="steal()">',
        ),
      ).toBe('<p>Terms</p><img src="x.jpg" />');
    });

    it('removes javascript: links', () => {
      expect(richText('<a href="javascript:steal()">Terms</a>')).toBe(
        '<a>Terms</a>',
      );
    });

    it('keeps benign markup', () => {
      const html =
        '<h2>Terms</h2><p>Read <strong>all</strong> of <a href="/se/sv/villkor" target="_blank" rel="noopener">this</a>.</p><ul><li>One</li></ul>';
      expect(richText(html)).toBe(html);
    });
  });

  it('leaves non-string text, html and css fields as they are', () => {
    const text = sanitizeCmsArea(
      areaWith([makeWidget('TextPageWidget', { text: 5 })]),
    );
    expect(firstWidget(text).data).toEqual({ text: 5 });

    const html = sanitizeCmsArea(
      areaWith([makeWidget('HTMLPageWidget', { html: 5, css: 6 })]),
    );
    expect(firstWidget(html).data).toEqual({ html: 5, css: 6 });
  });

  it('treats a container without content as empty', () => {
    const container = { ...makeContainer([]), content: undefined };
    const area = {
      meta: { title: '', description: '' },
      tags: [],
      containers: [container],
    } as unknown as ContentAreaType;
    expect(sanitizeCmsArea(area).containers[0]?.content).toEqual([]);
  });

  it('treats a page or area without containers as empty', () => {
    const page = { meta: { title: '', description: '' }, tags: [] };
    expect(
      sanitizeCmsPage(page as unknown as ContentPageType).containers,
    ).toEqual([]);
    expect(
      sanitizeCmsArea(page as unknown as ContentAreaType).containers,
    ).toEqual([]);
  });
});
