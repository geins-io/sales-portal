import { describe, it, expect } from 'vitest';
import type { ContentType } from '#shared/types/cms';
import { cmsAreaRendersH1 } from '../../shared/utils/cms-heading';

function widget(
  type: string,
  data: Record<string, unknown>,
  active?: boolean,
): ContentType {
  return {
    config: {
      name: type,
      displayName: type,
      active: active ?? true,
      type,
      size: 'full',
      sortOrder: 0,
    },
    data,
  };
}

function area(...content: ContentType[]) {
  return [
    {
      id: 'c1',
      name: 'Container',
      sortOrder: 0,
      layout: 'full',
      responsiveMode: 'stack',
      design: 'contained',
      content,
    },
  ];
}

describe('cmsAreaRendersH1', () => {
  it('is false for a missing or empty area', () => {
    expect(cmsAreaRendersH1(undefined)).toBe(false);
    expect(cmsAreaRendersH1(null)).toBe(false);
    expect(cmsAreaRendersH1([])).toBe(false);
  });

  it('is false for a container without content', () => {
    expect(cmsAreaRendersH1([{}, { content: null }])).toBe(false);
  });

  it('is true for a text widget whose title renders as h1', () => {
    expect(
      cmsAreaRendersH1(
        area(widget('TextPageWidget', { titleRenderMode: 0, title: 'Hi' })),
      ),
    ).toBe(true);
  });

  it('counts the rich text widget type the same as the text widget', () => {
    expect(
      cmsAreaRendersH1(
        area(
          widget('Rich textPageWidget', { titleRenderMode: 0, title: 'Hi' }),
        ),
      ),
    ).toBe(true);
  });

  it('is false for an h1 title mode with no title, since nothing renders', () => {
    expect(
      cmsAreaRendersH1(area(widget('TextPageWidget', { titleRenderMode: 0 }))),
    ).toBe(false);
    expect(
      cmsAreaRendersH1(
        area(widget('TextPageWidget', { titleRenderMode: 0, title: '' })),
      ),
    ).toBe(false);
  });

  it('is false for a text title rendered as h2', () => {
    expect(
      cmsAreaRendersH1(
        area(widget('TextPageWidget', { titleRenderMode: 1, title: 'Hi' })),
      ),
    ).toBe(false);
  });

  it('is true for h1 markup in a text widget body', () => {
    expect(
      cmsAreaRendersH1(
        area(widget('TextPageWidget', { text: '<H1 class="x">Hi</H1>' })),
      ),
    ).toBe(true);
    expect(
      cmsAreaRendersH1(
        area(widget('Rich textPageWidget', { text: '<h1>Hi</h1>' })),
      ),
    ).toBe(true);
  });

  it('is true for h1 markup in an html widget', () => {
    expect(
      cmsAreaRendersH1(area(widget('HTMLPageWidget', { html: '<h1>Hi</h1>' }))),
    ).toBe(true);
  });

  it('does not mistake h2..h6 or similar tags for an h1', () => {
    expect(
      cmsAreaRendersH1(
        area(
          widget('HTMLPageWidget', { html: '<h2>a</h2><h10>b</h10><header>' }),
          widget('TextPageWidget', { text: '<h1x>c</h1x>' }),
        ),
      ),
    ).toBe(false);
  });

  it('ignores h1 markup in a widget type that does not render it', () => {
    expect(
      cmsAreaRendersH1(
        area(
          widget('BannerPageWidget', { text1: '<h1>Hi</h1>', html: '<h1>' }),
          widget('JSONPageWidget', { titleRenderMode: 0, title: 'Hi' }),
        ),
      ),
    ).toBe(false);
  });

  it('ignores a widget without config, which resolves to no component', () => {
    expect(
      cmsAreaRendersH1([
        { content: [{ data: { html: '<h1>Hi</h1>' } }, { config: null }] },
      ]),
    ).toBe(false);
  });

  it('ignores an inactive widget, which the container drops', () => {
    expect(
      cmsAreaRendersH1(
        area(widget('HTMLPageWidget', { html: '<h1>Hi</h1>' }, false)),
      ),
    ).toBe(false);
  });

  it('finds an h1 in a later container', () => {
    const first = area(widget('HTMLPageWidget', { html: '<p>a</p>' }))[0]!;
    const second = {
      ...first,
      id: 'c2',
      content: [widget('HTMLPageWidget', { html: '<h1>b</h1>' })],
    };
    expect(cmsAreaRendersH1([first, second])).toBe(true);
  });

  it('ignores non-string text and html values', () => {
    expect(
      cmsAreaRendersH1(
        area(
          widget('HTMLPageWidget', { html: ['<h1>'] }),
          widget('TextPageWidget', { text: 1, titleRenderMode: 0, title: 5 }),
        ),
      ),
    ).toBe(false);
  });
});
