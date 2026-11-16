import { test as base } from '@playwright/test';
import { apiRoute } from './api-call';

export * from '@playwright/test';

const VIDEO_PLAYER_HOSTS = [
  'youtube.com',
  'youtube-nocookie.com',
  'ytimg.com',
  'player.vimeo.com',
  'vimeocdn.com',
];

/** The CMS video widget's embed and the player assets it pulls in. */
export function isVideoPlayerUrl(url: string): boolean {
  const { hostname } = new URL(url, 'http://localhost');
  return VIDEO_PLAYER_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

/**
 * The suite's `test`: Playwright's, plus automatic fixtures. Specs import
 * `test` from here so the fixtures run for every test in every project.
 */
export const test = base.extend<{
  videoPlayerAbort: undefined;
  libraryImageAccept: undefined;
  placesRealOrder: boolean;
  orderPlacementGuard: undefined;
}>({
  /**
   * A test that places a real order says so with
   * `test.use({ placesRealOrder: true })`. Every other test has its order
   * placement aborted, so an intercept that misses cannot place one.
   */
  placesRealOrder: [false, { option: true }],
  orderPlacementGuard: [
    async ({ context, placesRealOrder }, use) => {
      if (!placesRealOrder) {
        // A page's own route answers before this one, so a test that answers
        // create-order itself still gets its answer.
        await context.route(apiRoute('/api/checkout/create-order'), (route) =>
          route.request().method() === 'POST'
            ? route.abort('blockedbyclient')
            : route.fallback(),
        );
      }
      await use(undefined);
    },
    { auto: true },
  ],
  // A video frame holds `load` until the provider answers, so an outage there
  // times out `goto` on a page that has already rendered.
  videoPlayerAbort: [
    async ({ context }, use) => {
      await context.route(
        (url) => isVideoPlayerUrl(url.href),
        (route) => route.abort('blockedbyclient'),
      );
      await use(undefined);
    },
    { auto: true },
  ],
  libraryImageAccept: [
    async ({ context, browserName }, use) => {
      if (browserName === 'webkit') {
        // Linux WebKit stalls for seconds decoding JPEG XL, which no Safari
        // does; ask the CDN for what Safari without it gets.
        await context.route(
          (url) =>
            url.hostname === 'cdn.litium.media' &&
            url.searchParams.get('format') === 'auto',
          (route) => {
            const headers = route.request().headers();
            const accept = (headers['accept'] ?? '')
              .split(',')
              .filter((type) => type.trim() !== 'image/jxl')
              .join(',');
            return route.continue({ headers: { ...headers, accept } });
          },
        );
      }
      await use(undefined);
    },
    { auto: true },
  ],
});
