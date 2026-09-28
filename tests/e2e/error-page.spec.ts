import { test, expect, type Locator, type Page } from '@playwright/test';
import { waitForHydration } from './helpers';

/**
 * Error page → back into the app keeps the tenant theme.
 *
 * Two different pages answer a missing URL. A client-side navigation renders
 * `app/error.vue` inside the running app; a document request is answered by
 * the self-contained page in `server/error.ts`. Every tenant colour is scoped
 * to `html[data-theme]`, so the theme survives leaving either one only if that
 * attribute is still on `<html>` afterwards.
 */

/** Only the tenant block defines it — empty means the theme is not applied. */
const TENANT_VAR = '--button-background';

async function themeState(page: Page) {
  return page.evaluate((tenantVar) => {
    // The raw value may be hex; paint it once so it compares to a computed
    // background colour.
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${tenantVar})`;
    document.body.appendChild(probe);
    const tenantColor = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      tenantVar: getComputedStyle(document.documentElement)
        .getPropertyValue(tenantVar)
        .trim(),
      tenantColor,
    };
  }, TENANT_VAR);
}

type ThemeState = Awaited<ReturnType<typeof themeState>>;

/** Start page, hydrated, with the theme it rendered with. */
async function openStartPage(page: Page) {
  await page.goto('/');
  await waitForHydration(page);
  const themed = await themeState(page);
  expect(themed.theme, 'start page must carry data-theme').toBeTruthy();
  expect(
    themed.tenantVar,
    `${TENANT_VAR} must resolve on the start page`,
  ).not.toBe('');
  return { themed, startPath: new URL(page.url()).pathname };
}

/** Client-side navigation to a path no route or CMS page answers. */
async function navigateToMissingPage(page: Page, startPath: string) {
  const missing = `${startPath.replace(/\/?$/, '/')}e2e-missing-${Date.now()}`;
  await page.evaluate(
    (path) =>
      (
        window as unknown as {
          useNuxtApp: () => {
            $router: { push: (p: string) => Promise<unknown> };
          };
        }
      )
        .useNuxtApp()
        .$router.push(path),
    missing,
  );
  await expect(page.locator('.error-page')).toBeVisible();
  await expect(page.locator('.error-page__code')).toHaveText('404');
}

/** While the error page shows: themed, and its primary button paints the tenant colour. */
async function expectErrorPageThemed(
  page: Page,
  themed: ThemeState,
  primaryButton: Locator,
) {
  await expect
    .poll(() => themeState(page), {
      message: 'tenant theme must apply on the error page',
    })
    .toEqual(themed);
  await expect
    .poll(
      () =>
        primaryButton.evaluate((el) => getComputedStyle(el).backgroundColor),
      { message: 'primary button must paint the tenant button colour' },
    )
    .toBe(themed.tenantColor);
}

async function expectThemeKept(page: Page, themed: ThemeState) {
  await expect(page.locator('.error-page')).toHaveCount(0);
  await expect
    .poll(() => themeState(page), {
      message: 'tenant theme must still apply after leaving the error page',
    })
    .toEqual(themed);
}

test.describe('Error page keeps the tenant theme', () => {
  test('client-side 404 → home button', async ({ page }) => {
    const { themed, startPath } = await openStartPage(page);
    await navigateToMissingPage(page, startPath);
    // error.vue renders the home button first, the back button second.
    const home = page.locator('.error-page').getByRole('button').first();
    await expectErrorPageThemed(page, themed, home);

    await home.click();
    await page.waitForURL((url) => url.pathname === startPath);

    await expectThemeKept(page, themed);
  });

  test('client-side 404 → back button', async ({ page }) => {
    const { themed, startPath } = await openStartPage(page);
    await navigateToMissingPage(page, startPath);
    await expectErrorPageThemed(
      page,
      themed,
      page.locator('.error-page').getByRole('button').first(),
    );

    await page.locator('.error-page').getByRole('button').last().click();
    await page.waitForURL((url) => url.pathname === startPath);

    await expectThemeKept(page, themed);
  });

  test('document 404 → home link', async ({ page }) => {
    const { themed, startPath } = await openStartPage(page);

    const response = await page.goto(
      `${startPath.replace(/\/?$/, '/')}e2e-missing-${Date.now()}`,
    );
    expect(response?.status()).toBe(404);
    // server/error.ts answers the document request, not app/error.vue.
    await expect(page.locator('.error-page')).toHaveCount(0);
    const home = page.locator('a.btn-primary');
    await expectErrorPageThemed(page, themed, home);

    await home.click();
    await waitForHydration(page);

    await expectThemeKept(page, themed);
  });
});
