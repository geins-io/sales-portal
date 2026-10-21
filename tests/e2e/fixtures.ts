import { test as base } from '@playwright/test';

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

// Routes match on RegExps, never functions: Playwright cannot pass a function
// to the browser, so it intercepts every request, which WebKit pays for on
// every document, script and image.
const VIDEO_PLAYER_ROUTE = new RegExp(
  `^https?://([^/]+\\.)?(${VIDEO_PLAYER_HOSTS.map((host) =>
    host.replaceAll('.', '\\.'),
  ).join('|')})(:\\d+)?/`,
);

const LIBRARY_IMAGE_AUTO_ROUTE =
  /^https:\/\/cdn\.litium\.media\/[^?#]*\?([^#]*&)?format=auto([&#]|$)/;

/**
 * The suite's `test`: Playwright's, plus automatic fixtures. Specs import
 * `test` from here so the fixtures run for every test in every project.
 */
export const test = base.extend<{
  videoPlayerAbort: undefined;
  libraryImageAccept: undefined;
}>({
  // A video frame holds `load` until the provider answers, so an outage there
  // times out `goto` on a page that has already rendered.
  videoPlayerAbort: [
    async ({ context }, use) => {
      await context.route(VIDEO_PLAYER_ROUTE, (route) =>
        route.abort('blockedbyclient'),
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
        await context.route(LIBRARY_IMAGE_AUTO_ROUTE, (route) => {
          const headers = route.request().headers();
          const accept = (headers['accept'] ?? '')
            .split(',')
            .filter((type) => type.trim() !== 'image/jxl')
            .join(',');
          return route.continue({ headers: { ...headers, accept } });
        });
      }
      await use(undefined);
    },
    { auto: true },
  ],
});
