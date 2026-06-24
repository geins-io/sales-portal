import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// LayoutHeaderTopbar pulls in several auto-imported Nuxt composables
// (useAuthStore, useLocaleMarket, useTenant, useLogout, useCmsPageLink) that
// can't be mounted cleanly in vitest, so we assert the ticket's literal
// template requirements against the SFC source instead. These guard against
// regressions that would re-introduce the mobile logout button or shrink the
// bar / touch targets.

const source = readFileSync(
  resolve(process.cwd(), 'app/components/layout/header/LayoutHeaderTopbar.vue'),
  'utf-8',
);

/** Class string of the element carrying `data-testid="<id>"`. */
function classNear(id: string): string {
  const idx = source.indexOf(`data-testid="${id}"`);
  expect(idx).toBeGreaterThan(-1);
  return source.slice(Math.max(0, idx - 200), idx);
}

describe('LayoutHeaderTopbar mobile adjustments', () => {
  it('renders the bar at h-12, not the old h-10', () => {
    expect(source).toContain('h-12');
    expect(source).not.toContain('h-10');
  });

  it('hides the logout button below lg (mobile uses the drawer instead)', () => {
    const logoutClass = classNear('topbar-logout');
    expect(logoutClass).toContain('hidden');
    expect(logoutClass).toContain('lg:flex');
  });

  it('keeps the logout button available for desktop (lg and up)', () => {
    expect(source).toContain('data-testid="topbar-logout"');
  });

  it('adds py-2 touch padding to the login and portal affordances', () => {
    expect(classNear('topbar-login')).toContain('py-2');
    expect(classNear('topbar-portal')).toContain('py-2');
  });

  it('adds py-2 touch padding to the contact link', () => {
    const idx = source.indexOf('aria-label="$t(\'layout.contact_us\')"');
    expect(idx).toBeGreaterThan(-1);
    const classStart = source.indexOf('class="', idx);
    expect(source.slice(classStart, classStart + 80)).toContain('py-2');
  });
});
