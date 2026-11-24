import { test, expect, type Locator, type Page } from './fixtures';
import { outOfScope, waitForHydration } from './helpers';
import { apiGet } from './api-call';

/**
 * The header menu opens in the layout the store settings name (Menu layout:
 * mega menu, mega menu with collapsible categories, or catalogue).
 *
 * Each test reads `layout.menu` from `/api/config` and runs only for the
 * layout the target has saved; switching the setting in Studio switches which
 * test runs. Every value is covered at unit level.
 */

type MenuLayout = 'mega' | 'collapsible' | 'catalogue';

// The outer <nav>; the menu root inside it is a <nav> too.
const BAR = 'nav.bg-nav-bar-background';
const PANEL = '[data-slot="navigation-menu-content"]';

async function savedLayout(page: Page): Promise<MenuLayout> {
  const response = await apiGet(page.request, '/api/config');
  expect(response.ok(), '/api/config did not answer 200').toBe(true);
  const menu = (await response.json())?.layout?.menu as
    | { type?: string | null; collapsibleCategories?: boolean | null }
    | null
    | undefined;
  if (menu?.type === 'catalogue') return 'catalogue';
  return menu?.collapsibleCategories === true ? 'collapsible' : 'mega';
}

async function onlyFor(page: Page, layout: MenuLayout) {
  const saved = await savedLayout(page);
  outOfScope(
    saved !== layout,
    'tenant-config',
    `the store's menu layout is ${saved}`,
  );
}

const TRIGGER = '[data-slot="navigation-menu-trigger"]';
const OPEN_PANEL = `${PANEL}[data-state="open"]`;

async function loadBar(
  page: Page,
  path = '/',
): Promise<{ bar: Locator; triggers: Locator }> {
  await page.goto(path);
  await waitForHydration(page);
  const bar = page.locator(BAR);
  await expect(bar).toBeVisible();
  const triggers = bar.locator(TRIGGER);
  outOfScope(
    (await triggers.count()) === 0,
    'tenant-config',
    'the header menu has no item with children',
  );
  return { bar, triggers };
}

/**
 * The top item whose panel holds the most of `selector`, so a menu with
 * several categories is the one tested whatever order the tenant keeps.
 */
async function richestMenu(page: Page, selector: string): Promise<number> {
  const { bar, triggers } = await loadBar(page);
  let best = 0;
  let most = -1;
  const count = await triggers.count();
  for (let i = 0; i < count; i++) {
    await triggers.nth(i).hover();
    await expect(triggers.nth(i)).toHaveAttribute('data-state', 'open');
    const found = await bar.locator(OPEN_PANEL).locator(selector).count();
    if (found > most) [best, most] = [i, found];
  }
  return best;
}

/** Opens a top item with children as a buyer does: by hovering. */
async function openMenu(
  page: Page,
  index = 0,
): Promise<{ bar: Locator; panel: Locator }> {
  const { bar, triggers } = await loadBar(page);
  const trigger = triggers.nth(index);
  await trigger.hover();
  await expect(trigger).toHaveAttribute('data-state', 'open');
  const panel = bar.locator(OPEN_PANEL);
  await expect(panel).toBeVisible();
  return { bar, panel };
}

/**
 * Opens a top item from the keyboard and tabs into its panel. A menu opened
 * by hover keeps its panel out of the tab order until focus enters it so.
 */
async function openMenuByKeyboard(page: Page, index: number): Promise<Locator> {
  const { bar, triggers } = await loadBar(page);
  const trigger = triggers.nth(index);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('data-state', 'open');
  const panel = bar.locator(OPEN_PANEL);
  await page.keyboard.press('Tab');
  await expect
    .poll(() => panel.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true);
  return panel;
}

/**
 * The position of the focused element among the panel's reachable controls
 * (in the tab order and not folded), -1 when focus is elsewhere, and how
 * many there are.
 */
function focusInPanel(panel: Locator) {
  return panel.evaluate((root) => {
    const reachable = Array.from(
      root.querySelectorAll<HTMLElement>('a, button'),
    ).filter((el) => el.tabIndex >= 0 && !el.closest('[inert]'));
    return {
      at: reachable.indexOf(document.activeElement as HTMLElement),
      of: reachable.length,
    };
  });
}

/**
 * How a row reads: text size and weight, padding, corners and height. A
 * category link must read the same as a category button beside it.
 */
function rowLook(row: Locator) {
  return row.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      padding: style.padding,
      radius: style.borderTopLeftRadius,
      height: Math.round(el.getBoundingClientRect().height),
    };
  });
}

/**
 * The links and buttons under `root`, as named (text or aria-label) and
 * unnamed. Decoration hidden from assistive tech, such as the bar's scroll
 * arrows, is left out. Text, not visible text: a folded row is still named.
 */
function rowNames(root: Locator) {
  return root.locator('a, button').evaluateAll((rows) => {
    const shown = rows.filter((row) => !row.closest('[aria-hidden="true"]'));
    const named = (row: Element) =>
      !!row.textContent?.trim() || !!row.getAttribute('aria-label')?.trim();
    return {
      named: shown.filter(named).length,
      unnamed: shown
        .filter((row) => !named(row))
        .map((row) => row.outerHTML.slice(0, 200)),
    };
  });
}

async function expectNamedRows(root: Locator, where: string) {
  const { named, unnamed } = await rowNames(root);
  expect(unnamed, `rows without a name in ${where}`).toEqual([]);
  expect(named, `named rows in ${where}`).toBeGreaterThan(0);
}

/** Whether focus sits in a folded (inert) part of the menu. */
function focusIsInert(page: Page) {
  return page.evaluate(() => !!document.activeElement?.closest('[inert]'));
}

test.describe('Header menu layout from the store settings', () => {
  test.beforeEach(({ isMobile }) => {
    outOfScope(isMobile, 'mobile-project', 'the header menu is desktop only');
  });

  test('the mega menu lists every second-level heading with its third level under it', async ({
    page,
  }) => {
    await onlyFor(page, 'mega');
    const { panel } = await openMenu(page);

    await expect(panel.locator('.grid.grid-cols-4')).toBeVisible();
    await expect(panel.locator('a').first()).toBeVisible();
    await expect(panel.locator('button[aria-expanded]')).toHaveCount(0);
    await expect(panel.locator('[data-testid="menu-collapsible"]')).toHaveCount(
      0,
    );
    await expect(panel.locator('[data-testid="menu-catalogue"]')).toHaveCount(
      0,
    );
    await expect(
      page.locator('[data-testid="menu-catalogue-backdrop"]'),
    ).toHaveCount(0);
  });

  test('names every row in a non-default locale, whatever the layout', async ({
    page,
  }) => {
    // A CMS item has no name in a language nobody translated it into.
    const response = await apiGet(page.request, '/api/config');
    expect(response.ok(), '/api/config did not answer 200').toBe(true);
    const config = await response.json();
    const short = (tag: string) => tag.split('-')[0]!;
    const fallback = short(String(config?.locale ?? ''));
    const others = ((config?.availableLocales ?? []) as string[])
      .map(short)
      .filter((code) => code !== fallback);
    outOfScope(
      others.length === 0,
      'tenant-config',
      'the store offers a single locale',
    );
    const code = others.includes('en') ? 'en' : others[0]!;

    const { bar, triggers } = await loadBar(
      page,
      `/${config?.market}/${code}/`,
    );
    await expectNamedRows(bar, `the bar in ${code}`);
    const count = await triggers.count();
    for (let i = 0; i < count; i++) {
      await triggers.nth(i).hover();
      await expect(triggers.nth(i)).toHaveAttribute('data-state', 'open');
      const panel = bar.locator(OPEN_PANEL);
      await expect(panel).toBeVisible();
      await expectNamedRows(panel, `menu ${i + 1} in ${code}`);
    }
  });

  test.describe('collapsible categories', () => {
    const TOGGLE = 'button[aria-expanded]';

    async function openCollapsible(page: Page) {
      const { panel } = await openMenu(page, await richestMenu(page, TOGGLE));
      await expect(
        panel.locator('[data-testid="menu-collapsible"]'),
      ).toBeVisible();
      const toggles = panel.locator(TOGGLE);
      outOfScope(
        (await toggles.count()) === 0,
        'tenant-config',
        'no second-level category in the header menu has children',
      );
      return { panel, toggles };
    }

    test('show a heading without children like a folded toggle heading', async ({
      page,
    }) => {
      await onlyFor(page, 'collapsible');
      const { panel, toggles } = await openCollapsible(page);
      const plain = panel.locator(
        '[data-testid="menu-collapsible"] > ul > li > a',
      );
      outOfScope(
        (await plain.count()) === 0,
        'tenant-config',
        'every second-level category in the menu has children',
      );
      expect(await rowLook(plain.first())).toEqual(
        await rowLook(toggles.first()),
      );
    });

    test('fold the third level behind whole-row toggles, several open at once', async ({
      page,
    }) => {
      await onlyFor(page, 'collapsible');
      const { panel, toggles } = await openCollapsible(page);

      const count = await toggles.count();
      for (let i = 0; i < count; i++) {
        await expect(toggles.nth(i)).toHaveAttribute('aria-expanded', 'false');
      }
      const first = toggles.first();
      const region = panel.locator(
        `#${await first.getAttribute('aria-controls')}`,
      );
      await expect(region.locator('a').first()).not.toBeInViewport();
      expect((await region.boundingBox())?.height ?? 0).toBeLessThan(1);

      // The chevron end of the row toggles as well as the label.
      const box = await first.boundingBox();
      expect(box).not.toBeNull();
      await first.click({
        position: { x: box!.width - 6, y: box!.height / 2 },
      });
      await expect(first).toHaveAttribute('aria-expanded', 'true');
      await expect(region.locator('a').first()).toBeVisible();
      await expect(first).toHaveCSS('font-weight', '600');
      expect(await region.locator('a').count()).toBeGreaterThanOrEqual(2);

      if (count > 1) {
        await toggles.nth(1).click();
        await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
        await expect(first).toHaveAttribute('aria-expanded', 'true');
      }

      await first.click();
      await expect(first).toHaveAttribute('aria-expanded', 'false');
      await expect(panel).toBeVisible();
    });

    test('keep folded links out of Tab and the arrow keys', async ({
      page,
    }) => {
      await onlyFor(page, 'collapsible');
      const index = await richestMenu(page, TOGGLE);

      // Each key from a freshly entered panel: once focus leaves it, the
      // menu takes its controls out of the tab order again.
      async function enter() {
        const panel = await openMenuByKeyboard(page, index);
        const toggles = panel.locator(TOGGLE);
        outOfScope(
          (await toggles.count()) === 0,
          'tenant-config',
          'no second-level category in the header menu has children',
        );
        const first = toggles.first();
        await first.focus();
        return { panel, first };
      }

      // Folded, the next stop is the next heading, or out of the panel.
      for (const key of ['Tab', 'ArrowDown']) {
        const { panel } = await enter();
        const from = await focusInPanel(panel);
        expect(from.at).toBeGreaterThanOrEqual(0);
        await page.keyboard.press(key);
        expect(await focusIsInert(page), `${key} landed on a folded link`).toBe(
          false,
        );
        const to = await focusInPanel(panel);
        if (from.at + 1 < from.of) {
          expect(to.at, `${key} did not reach the next heading`).toBe(
            from.at + 1,
          );
        } else if (key === 'Tab') {
          expect(to.at, 'Tab stayed in the panel').toBe(-1);
        } else {
          expect(to.at, 'ArrowDown moved off the last heading').toBe(from.at);
        }
      }

      // Open, its first link is next in line, for Tab and ArrowDown alike.
      for (const key of ['Tab', 'ArrowDown']) {
        const { panel, first } = await enter();
        await page.keyboard.press('Enter');
        await expect(first).toHaveAttribute('aria-expanded', 'true');
        await expect(first).toBeFocused();
        const region = panel.locator(
          `#${await first.getAttribute('aria-controls')}`,
        );
        await page.keyboard.press(key);
        await expect(region.locator('a').first()).toBeFocused();
      }
    });

    test('slide open, and not when the buyer prefers reduced motion', async ({
      page,
    }) => {
      await onlyFor(page, 'collapsible');
      const { panel, toggles } = await openCollapsible(page);
      const region = panel.locator(
        `#${await toggles.first().getAttribute('aria-controls')}`,
      );
      await expect(region).toHaveCSS(
        'transition-property',
        'grid-template-rows',
      );

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(region).toHaveCSS('transition-property', 'none');
    });
  });

  test.describe('catalogue', () => {
    async function openCatalogue(page: Page) {
      const { bar, panel } = await openMenu(
        page,
        await richestMenu(page, 'button[aria-expanded]'),
      );
      const catalogue = panel.locator('[data-testid="menu-catalogue"]');
      await expect(catalogue).toBeVisible();
      return {
        bar,
        catalogue,
        box: page.locator('[data-testid="menu-catalogue-panel"]'),
        dim: page.locator('[data-testid="menu-catalogue-backdrop"]'),
        columns: catalogue.locator('[data-menu-column]'),
        categories: catalogue.locator('button[aria-expanded]'),
      };
    }

    test('shows a category without children like the category buttons', async ({
      page,
    }) => {
      await onlyFor(page, 'catalogue');
      const { columns, categories } = await openCatalogue(page);
      const link = columns.first().locator(':scope > a');
      outOfScope(
        (await link.count()) === 0 || (await categories.count()) === 0,
        'tenant-config',
        'the menu has no second-level category both with and without children',
      );
      expect(await rowLook(link.first())).toEqual(
        await rowLook(categories.first()),
      );
    });

    test('opens on the list alone, and a category opens one column beside it', async ({
      page,
    }) => {
      await onlyFor(page, 'catalogue');
      const { columns, categories } = await openCatalogue(page);
      await expect(columns).toHaveCount(1);
      const count = await categories.count();
      for (let i = 0; i < count; i++) {
        await expect(categories.nth(i)).toHaveAttribute(
          'aria-expanded',
          'false',
        );
      }
      outOfScope(
        count === 0,
        'tenant-config',
        'no second-level category in the first menu has children',
      );

      const first = categories.first();
      await first.click();
      await expect(first).toHaveAttribute('aria-expanded', 'true');
      await expect(columns).toHaveCount(2);
      await expect(columns.nth(1)).toHaveAttribute(
        'id',
        (await first.getAttribute('aria-controls'))!,
      );
      // Three levels at most: the column holds links only.
      await expect(columns.nth(1).locator('button')).toHaveCount(0);
      await expect(columns.nth(1).locator('a').first()).toBeVisible();

      if (count > 1) {
        await categories.nth(1).click();
        await expect(first).toHaveAttribute('aria-expanded', 'false');
        await expect(columns).toHaveCount(2);
      }
      await categories.nth(count > 1 ? 1 : 0).click();
      await expect(columns).toHaveCount(1);
    });

    test('sits at the content edge below the bar, only as wide as its columns, over a dimmed page', async ({
      page,
    }) => {
      await onlyFor(page, 'catalogue');
      const { bar, box, dim } = await openCatalogue(page);
      const viewport = page.viewportSize()!;
      const barBox = (await bar.boundingBox())!;
      // Where an absolutely placed `top-full` child starts: the bar's padding
      // box, over its bottom border, as the mega menu's panel does.
      const barBottom = await bar.evaluate(
        (el) => el.getBoundingClientRect().top + el.clientTop + el.clientHeight,
      );
      const gutter = (await bar
        .locator('[data-nav-gutter="start"]')
        .boundingBox())!;
      // Measured where it lands, after the drop.
      await box.evaluate((el) =>
        Promise.all(el.getAnimations().map((a) => a.finished)),
      );
      const panelBox = (await box.boundingBox())!;
      const dimBox = (await dim.boundingBox())!;

      expect(Math.abs(panelBox.x - (gutter.x + gutter.width))).toBeLessThan(1);
      expect(Math.abs(panelBox.y - barBottom)).toBeLessThan(1);
      expect(panelBox.width).toBeLessThan(barBox.width / 2);
      await expect(box).not.toHaveCSS('box-shadow', 'none');

      expect(Math.abs(dimBox.y - barBottom)).toBeLessThan(1);
      expect(Math.abs(dimBox.y + dimBox.height - viewport.height)).toBeLessThan(
        1,
      );
      expect(dimBox.width).toBeGreaterThanOrEqual(viewport.width - 20);
    });

    test('stays open when the mouse leaves the panel and closes on a click on the dimmed page', async ({
      page,
    }) => {
      await onlyFor(page, 'catalogue');
      const { bar, box } = await openCatalogue(page);
      const viewport = page.viewportSize()!;
      const spot = { x: viewport.width - 40, y: viewport.height - 40 };

      await page.mouse.move(spot.x, spot.y, { steps: 5 });
      // Longer than the menu's close delay on leave.
      await page.waitForTimeout(1000);
      await expect(box).toBeVisible();

      await page.mouse.click(spot.x, spot.y);
      await expect(box).toBeHidden();
      await expect(
        bar.locator('[data-slot="navigation-menu-trigger"]').first(),
      ).toHaveAttribute('data-state', 'closed');
    });

    test('drops down, and not when the buyer prefers reduced motion', async ({
      page,
    }) => {
      await onlyFor(page, 'catalogue');
      const { box } = await openCatalogue(page);
      await expect(box).not.toHaveCSS('animation-name', 'none');

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(box).toHaveCSS('animation-name', 'none');
    });
  });
});
