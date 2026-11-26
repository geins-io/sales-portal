import { describe, it, expect } from 'vitest';
import {
  outlineRoundedSubset,
  readIconSet,
  type IconSet,
} from '../../config/icon-collections';

const icon = (body: string) => ({ body });

const SET: IconSet = {
  prefix: 'material-symbols',
  width: 24,
  height: 24,
  icons: {
    home: icon('home'),
    'home-outline': icon('home-outline'),
    'home-rounded': icon('home-rounded'),
    'home-outline-rounded': icon('home-outline-rounded'),
    'home-sharp': icon('home-sharp'),
    // One drawing for outline and filled: no -outline-rounded of its own.
    'auto-graph': icon('auto-graph'),
    'auto-graph-rounded': icon('auto-graph-rounded'),
    'auto-graph-sharp': icon('auto-graph-sharp'),
    // A brand icon with neither style.
    'android-chat': icon('android-chat'),
    lock: icon('lock'),
    'lock-outline-rounded-base': icon('lock-outline-rounded-base'),
    'tune-base': icon('tune-base'),
  },
  aliases: {
    'house-outline-rounded': { parent: 'home-outline-rounded' },
    // An alias chain down to an icon that is not outline rounded itself.
    'lock-outline-rounded': { parent: 'lock-middle' },
    'lock-middle': { parent: 'lock-outline-rounded-base', rotate: 1 },
    // -rounded only as an alias, still no -outline-rounded.
    'tune-rounded': { parent: 'tune-base' },
    'unused-alias': { parent: 'home' },
    // A chain that ends nowhere: kept as it is, nothing invented.
    'broken-outline-rounded': { parent: 'missing' },
  },
};

describe('outlineRoundedSubset', () => {
  const subset = outlineRoundedSubset(SET);

  it('keeps the prefix and dimensions', () => {
    expect(subset.prefix).toBe('material-symbols');
    expect(subset.width).toBe(24);
    expect(subset.height).toBe(24);
  });

  it('keeps only the outline rounded icons and what they point at', () => {
    expect(Object.keys(subset.icons).sort()).toEqual([
      'auto-graph-rounded',
      'home-outline-rounded',
      'lock-outline-rounded-base',
      'tune-base',
    ]);
    expect(subset.icons['home-outline-rounded']).toEqual(
      icon('home-outline-rounded'),
    );
  });

  it('keeps outline rounded aliases with their whole parent chain', () => {
    expect(subset.aliases?.['house-outline-rounded']).toEqual({
      parent: 'home-outline-rounded',
    });
    expect(subset.aliases?.['lock-outline-rounded']).toEqual({
      parent: 'lock-middle',
    });
    expect(subset.aliases?.['lock-middle']).toEqual({
      parent: 'lock-outline-rounded-base',
      rotate: 1,
    });
  });

  it('points a missing outline rounded name at its rounded drawing', () => {
    expect(subset.aliases?.['auto-graph-outline-rounded']).toEqual({
      parent: 'auto-graph-rounded',
    });
    expect(subset.aliases?.['tune-outline-rounded']).toEqual({
      parent: 'tune-rounded',
    });
    expect(subset.aliases?.['tune-rounded']).toEqual({ parent: 'tune-base' });
  });

  it('keeps an alias whose chain ends nowhere, without its missing parent', () => {
    expect(subset.aliases?.['broken-outline-rounded']).toEqual({
      parent: 'missing',
    });
    expect(subset.aliases?.missing).toBeUndefined();
    expect(subset.icons.missing).toBeUndefined();
  });

  it('adds no fallback where the outline rounded name exists', () => {
    expect(subset.aliases?.['home-outline-rounded']).toBeUndefined();
    expect(subset.aliases?.['home-rounded']).toBeUndefined();
  });

  it('leaves out every other style and unused alias', () => {
    const names = [
      ...Object.keys(subset.icons),
      ...Object.keys(subset.aliases ?? {}),
    ];
    for (const name of [
      'home',
      'home-outline',
      'home-rounded',
      'home-sharp',
      'auto-graph',
      'auto-graph-sharp',
      'android-chat',
      'lock',
      'unused-alias',
    ])
      expect(names).not.toContain(name);
  });

  it('does not change the set it reads', () => {
    expect(Object.keys(SET.icons)).toHaveLength(12);
    expect(Object.keys(SET.aliases ?? {})).toHaveLength(6);
  });

  it('copies a set without aliases or dimensions', () => {
    expect(
      outlineRoundedSubset({
        prefix: 'x',
        icons: { 'a-outline-rounded': icon('a'), b: icon('b') },
      }),
    ).toEqual({
      prefix: 'x',
      icons: { 'a-outline-rounded': icon('a') },
      aliases: {},
    });
  });
});

describe('readIconSet', () => {
  it('reads an installed Iconify set', () => {
    const set = readIconSet('lucide');
    expect(set.prefix).toBe('lucide');
    expect(set.icons['file-text']?.body).toContain('<path');
  });
});
