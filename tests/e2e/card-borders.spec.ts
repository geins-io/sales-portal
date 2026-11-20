import { test, expect, type Locator, type Page } from './fixtures';
import {
  discoverCategory,
  discoverProduct,
  hasE2ECredentials,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';

/**
 * Card frames follow the card border token.
 *
 * The store setting Card borders off makes the tenant theme emit
 * `--card-border: transparent` (unit-tested in tenant-css.test.ts). This spec
 * proves the other half, independent of what the target tenant has saved:
 * it forces the token to a marker colour and checks that each card frame
 * paints it at an unchanged width and size, while the rows and boxes inside a
 * frame keep their own border. Then it forces transparent, as the setting
 * does, and checks that nothing moves.
 */

const MARKER = 'rgb(255, 0, 0)';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

interface FrameState {
  color: string;
  width: string;
  w: number;
  h: number;
}

async function frameState(frame: Locator): Promise<FrameState> {
  return frame.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      color: style.borderTopColor,
      width: style.borderTopWidth,
      w: rect.width,
      h: rect.height,
    };
  });
}

/** Forces the token; `!important` outranks the tenant theme block. */
async function forceCardBorder(page: Page, value: string) {
  await page.addStyleTag({
    content: `html { --card-border: ${value} !important; }`,
  });
}

/** Borders inside a frame that took the marker: rows must not. */
async function innerBordersOnMarker(frame: Locator, marker: string) {
  return frame.evaluate((el, markerColour) => {
    let bordered = 0;
    let onMarker = 0;
    for (const child of Array.from(el.querySelectorAll('*'))) {
      const style = getComputedStyle(child);
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (style.getPropertyValue(`border-${side}-width`) === '0px') continue;
        if (style.getPropertyValue(`border-${side}-style`) === 'none') continue;
        bordered += 1;
        if (style.getPropertyValue(`border-${side}-color`) === markerColour) {
          onMarker += 1;
        }
      }
    }
    return { bordered, onMarker };
  }, marker);
}

/**
 * Forces the marker, then transparent, and checks every frame against the
 * size it had before. `inner` names the frames whose content has no card of
 * its own, so every border inside them belongs to a row or a box.
 */
async function expectFramesFollowToken(
  page: Page,
  frames: Record<string, Locator>,
  inner: string[] = [],
) {
  const before: Record<string, FrameState> = {};
  for (const [name, frame] of Object.entries(frames)) {
    await expect(frame, name).toBeVisible();
    before[name] = await frameState(frame);
    expect(before[name].width, `${name} has a border width`).not.toBe('0px');
  }

  await forceCardBorder(page, MARKER);
  for (const [name, frame] of Object.entries(frames)) {
    const state = await frameState(frame);
    expect(state.color, `${name} paints the card border token`).toBe(MARKER);
    expect(state, `${name} keeps its width and size`).toMatchObject({
      width: before[name]!.width,
      w: before[name]!.w,
      h: before[name]!.h,
    });
  }
  // Summed, not per frame: whether one panel holds bordered rows depends on
  // the account's data. The check only means something when some do.
  let innerBordered = 0;
  for (const name of inner) {
    const { bordered, onMarker } = await innerBordersOnMarker(
      frames[name]!,
      MARKER,
    );
    innerBordered += bordered;
    expect(onMarker, `nothing inside ${name} follows the card token`).toBe(0);
  }
  if (inner.length) {
    expect(innerBordered, 'the frames hold rows with a border').toBeGreaterThan(
      0,
    );
  }

  await forceCardBorder(page, 'transparent');
  for (const [name, frame] of Object.entries(frames)) {
    const state = await frameState(frame);
    expect(state.color, `${name} border is transparent`).toBe(TRANSPARENT);
    expect(state, `${name} does not move with the border off`).toMatchObject({
      width: before[name]!.width,
      w: before[name]!.w,
      h: before[name]!.h,
    });
  }
}

test.describe('Card borders on the storefront', () => {
  test('product cards on a category page follow the card border token', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);
    await waitForHydration(page);

    await expectFramesFollowToken(page, {
      'product card': page.getByTestId('product-card').first(),
    });
  });

  test('the product page frames follow the card border token', async ({
    page,
  }) => {
    const product = await discoverProduct(page);
    await page.goto(`/p/${product.alias}`);
    await waitForHydration(page);

    const frames: Record<string, Locator> = {
      'top area': page.getByTestId('pdp-top-area'),
    };
    // Below md the tabs are an unframed accordion.
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      frames['open tab panel'] = page
        .getByTestId('product-tabs')
        .locator('[role="tabpanel"][data-state="active"]');
    }

    await expectFramesFollowToken(page, frames, ['top area']);
  });

  test('the sign-in card and a content page frame follow the card border token', async ({
    page,
  }) => {
    await page.goto('/login');
    await waitForHydration(page);

    await expectFramesFollowToken(
      page,
      { 'sign-in card': page.locator('[data-slot="card"]').first() },
      ['sign-in card'],
    );

    // The apply page is a framed CMS page; its path is per tenant, so it is
    // read off the sign-in card's link rather than hardcoded.
    const applyButton = page.getByTestId('auth-apply-button');
    outOfScope(
      !(await applyButton.isVisible().catch(() => false)),
      'tenant-config',
      'tenant has no resolvable CMS apply page',
    );
    const href = await applyButton.getAttribute('href');
    expect(href, 'apply button must be a real link').toBeTruthy();
    await page.goto(href!);
    await waitForHydration(page);

    // Not checked for inner borders: CMS content may hold cards of its own.
    await expectFramesFollowToken(page, {
      'content page frame': page.getByTestId('content-frame'),
    });
  });
});

test.describe('Card borders in the portal', () => {
  outOfScope(
    !hasE2ECredentials(),
    'no-credentials',
    'portal pages need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
  );
  test.use({ storageState: signedInState });

  test('overview frames follow the card border token and their rows do not', async ({
    page,
  }) => {
    await page.goto('/portal');
    await waitForHydration(page);

    const panels = page
      .getByTestId('overview-lists-row')
      .locator(':scope > div');
    await expect(panels.first()).toBeVisible();
    const frames: Record<string, Locator> = {
      'welcome box': page.getByTestId('portal-welcome'),
      'stat card': page.getByTestId('portal-stat-card').first(),
      // Panel > PortalOrdersTable root > the list; its rows are the
      // "Latest orders" rows that keep their border.
      'latest orders': page
        .getByTestId('portal-orders-table')
        .locator('xpath=../..'),
    };
    const inner: string[] = ['latest orders'];
    for (let i = 0; i < (await panels.count()); i += 1) {
      frames[`overview panel ${i + 1}`] = panels.nth(i);
      inner.push(`overview panel ${i + 1}`);
    }

    await expectFramesFollowToken(page, frames, inner);
  });
});
