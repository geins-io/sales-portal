import { test as base } from '@playwright/test';

export * from '@playwright/test';

/**
 * The suite's `test`: Playwright's, plus one automatic fixture. Specs import
 * `test` from here so the fixture runs for every test in every project.
 */
export const test = base.extend<{ libraryImageAccept: undefined }>({
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
