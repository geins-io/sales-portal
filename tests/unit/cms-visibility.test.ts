import { describe, it, expect } from 'vitest';
import type { ContentContainerType } from '@geins/types';
import {
  cmsVisibilityClass,
  mergeContainersByVisibility,
} from '../../shared/utils/cms-visibility';

describe('cmsVisibilityClass', () => {
  it('hides a mobile-only container from the md breakpoint up', () => {
    expect(cmsVisibilityClass('mobile')).toBe('md:hidden');
  });

  it('hides a desktop-only container below the md breakpoint', () => {
    expect(cmsVisibilityClass('desktop')).toBe('hidden md:block');
  });

  it('returns no class for the always-visible value', () => {
    expect(cmsVisibilityClass('always')).toBe('');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(cmsVisibilityClass('  Mobile ')).toBe('md:hidden');
    expect(cmsVisibilityClass('DESKTOP')).toBe('hidden md:block');
  });

  it('treats empty/unknown values as always visible', () => {
    expect(cmsVisibilityClass('')).toBe('');
    expect(cmsVisibilityClass(null)).toBe('');
    expect(cmsVisibilityClass(undefined)).toBe('');
    expect(cmsVisibilityClass('something-new')).toBe('');
  });
});

describe('mergeContainersByVisibility', () => {
  const make = (id: string, sortOrder = 0): ContentContainerType =>
    ({
      id,
      name: id,
      sortOrder,
      layout: 'full',
      responsiveMode: 'stack',
      design: 'default',
      content: [],
    }) as ContentContainerType;

  it("tags a container present in both legs as 'always'", () => {
    const merged = mergeContainersByVisibility([make('1')], [make('1')]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.visibility).toBe('always');
  });

  it("tags a desktop-leg-only container as 'desktop'", () => {
    const merged = mergeContainersByVisibility([make('1')], []);
    expect(merged[0]?.visibility).toBe('desktop');
  });

  it("tags a mobile-leg-only container as 'mobile'", () => {
    const merged = mergeContainersByVisibility([], [make('2')]);
    expect(merged[0]?.visibility).toBe('mobile');
  });

  it('keeps the only-mobile container alongside the always containers', () => {
    // Mirrors the live monitor "Section 02" case: the always blocks come back
    // in both legs, the only-mobile block only in the mobile leg.
    const desktop = [make('hero', 0), make('section1', 1)];
    const mobile = [make('hero', 0), make('section2', 2), make('section1', 1)];

    const merged = mergeContainersByVisibility(desktop, mobile);

    const byId = Object.fromEntries(merged.map((c) => [c.id, c.visibility]));
    expect(byId.hero).toBe('always');
    expect(byId.section1).toBe('always');
    expect(byId.section2).toBe('mobile');
    expect(merged).toHaveLength(3);
  });

  it('de-duplicates by id and orders by sortOrder', () => {
    const desktop = [make('b', 2), make('a', 1)];
    const mobile = [make('a', 1), make('c', 3)];

    const merged = mergeContainersByVisibility(desktop, mobile);

    expect(merged.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(merged.filter((c) => c.id === 'a')).toHaveLength(1);
  });
});
