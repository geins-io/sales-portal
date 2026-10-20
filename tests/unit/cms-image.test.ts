import { describe, it, expect } from 'vitest';
import {
  composeAssetUrl,
  widgetImageUrl,
  widgetMobileImage,
} from '../../shared/utils/cms-image';

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

describe('widgetMobileImage', () => {
  const MOBILE = 'https://cdn.litium.media/acme/content/hero-mobile.png';
  const image = {
    filename: 'hero.png',
    path: 'content/hero.png',
    filenameForMobileDevice: 'hero-mobile.png',
    pathForMobileDevice: 'content/hero-mobile.png',
  };

  it('locates the mobile image by its own file name and path', () => {
    expect(
      widgetMobileImage(image, [
        { fileName: 'hero.png', url: LIBRARY },
        { fileName: 'hero-mobile.png', url: MOBILE },
      ]),
    ).toEqual({
      fileName: 'hero-mobile.png',
      url: MOBILE,
      path: 'content/hero-mobile.png',
    });
  });

  it('leaves the url null for a mobile image outside the library', () => {
    expect(
      widgetMobileImage(
        { filename: 'hero.png', filenameForMobileDevice: 'hero-mobile.png' },
        [{ fileName: 'hero.png', url: LIBRARY }],
      ),
    ).toEqual({ fileName: 'hero-mobile.png', url: null, path: undefined });
  });

  it.each([null, undefined, ''])(
    'gives nothing when the editor set no mobile image (%s)',
    (filenameForMobileDevice) => {
      expect(
        widgetMobileImage({ ...image, filenameForMobileDevice }, [
          { fileName: 'hero.png', url: LIBRARY },
        ]),
      ).toBeUndefined();
      expect(widgetMobileImage(undefined, [])).toBeUndefined();
    },
  );
});

describe('composeAssetUrl', () => {
  const HOST = 'https://cdn.example.test/acme';

  it('joins the host and the path with one slash', () => {
    expect(composeAssetUrl(HOST, 'content/hero.png')).toBe(
      `${HOST}/content/hero.png`,
    );
  });

  it.each([
    [`${HOST}/`, 'content/hero.png'],
    [`${HOST}//`, 'content/hero.png'],
    [HOST, '/content/hero.png'],
    [HOST, '//content/hero.png'],
  ])('trims the slashes between %s and %s', (host, path) => {
    expect(composeAssetUrl(host, path)).toBe(`${HOST}/content/hero.png`);
  });

  it.each([
    ['content/group 2.jpg', 'content/group%202.jpg'],
    ['content/image (1).jpg', 'content/image%20%281%29.jpg'],
    ["content/a!b'c*.jpg", 'content/a%21b%27c%2A.jpg'],
    ['content/a#b?.jpg', 'content/a%23b%3F.jpg'],
    ['content/100%.jpg', 'content/100%25.jpg'],
    ['content/a+b&c=d,e;f.jpg', 'content/a%2Bb%26c%3Dd%2Ce%3Bf.jpg'],
    ['content/åäö.jpg', 'content/%C3%A5%C3%A4%C3%B6.jpg'],
    ['content/sub folder/x.jpg', 'content/sub%20folder/x.jpg'],
    ['content/A-Z_a.z~0.jpg', 'content/A-Z_a.z~0.jpg'],
  ])(
    'encodes each segment of %s as the asset contract does',
    (path, encoded) => {
      expect(composeAssetUrl(HOST, path)).toBe(`${HOST}/${encoded}`);
    },
  );

  it.each([
    [null, 'content/hero.png'],
    [undefined, 'content/hero.png'],
    ['', 'content/hero.png'],
    [HOST, null],
    [HOST, undefined],
    [HOST, ''],
    [HOST, '/'],
  ])('returns null for host %s and path %s', (host, path) => {
    expect(composeAssetUrl(host, path)).toBeNull();
  });
});
