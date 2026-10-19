import { describe, it, expect } from 'vitest';
import { widgetImageUrl } from '../../shared/utils/cms-image';

const LIBRARY = 'https://cdn.litium.media/acme/content/hero.png';

describe('widgetImageUrl', () => {
  it('returns the library url of the image the configuration names', () => {
    expect(
      widgetImageUrl(
        [
          {
            fileName: 'other.png',
            url: 'https://cdn.litium.media/acme/content/other.png',
          },
          { fileName: 'hero.png', url: LIBRARY },
        ],
        'hero.png',
      ),
    ).toBe(LIBRARY);
  });

  it('returns null when the named image has no library url', () => {
    expect(
      widgetImageUrl([{ fileName: 'hero.png', url: null }], 'hero.png'),
    ).toBeNull();
    expect(widgetImageUrl([{ fileName: 'hero.png' }], 'hero.png')).toBeNull();
  });

  it('returns null when no image matches the file name exactly', () => {
    expect(
      widgetImageUrl([{ fileName: 'hero.png', url: LIBRARY }], 'Hero.png'),
    ).toBeNull();
    expect(
      widgetImageUrl([{ fileName: 'hero.png', url: LIBRARY }], 'banner.png'),
    ).toBeNull();
  });

  it('returns null without a file name or an image list', () => {
    expect(widgetImageUrl([{ fileName: '', url: LIBRARY }], '')).toBeNull();
    expect(widgetImageUrl(undefined, 'hero.png')).toBeNull();
    expect(widgetImageUrl(null, 'hero.png')).toBeNull();
    expect(widgetImageUrl([], 'hero.png')).toBeNull();
  });
});
