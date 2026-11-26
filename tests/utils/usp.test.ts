import { describe, it, expect } from 'vitest';
import {
  readUsp,
  uspDesktopPerRow,
  uspIconName,
  uspTabletPerRow,
} from '../../app/utils/usp';

const ICON = 'material-symbols:local-shipping-outline-rounded';

describe('uspIconName', () => {
  it.each([
    ['local_shipping', ICON],
    ['Local Shipping', ICON],
    ['  local   shipping ', ICON],
    ['LOCAL__SHIPPING', ICON],
    ['local-shipping', ICON],
    ['eco', 'material-symbols:eco-outline-rounded'],
    ['counter_1', 'material-symbols:counter-1-outline-rounded'],
  ])('maps %j to the rounded outline icon', (raw, name) => {
    expect(uspIconName(raw)).toBe(name);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'blank'],
    [undefined, 'missing'],
    [42, 'a number'],
    [null, 'null'],
    ['local_shipping;x', 'a semicolon'],
    ['../local', 'a path'],
    ['local,shipping', 'a comma'],
    ['_local', 'a leading separator'],
    ['local_', 'a trailing separator'],
    ['local-_shipping', 'mixed separators'],
    ['lokal_frakt_å', 'a letter outside a–z'],
  ])('gives no icon for %j (%s)', (raw, _why) => {
    expect(uspIconName(raw)).toBe('');
  });

  it('accepts a name of 64 characters and refuses 65', () => {
    expect(uspIconName('a'.repeat(64))).toBe(
      `material-symbols:${'a'.repeat(64)}-outline-rounded`,
    );
    expect(uspIconName('a'.repeat(65))).toBe('');
  });
});

describe('selling points per row', () => {
  it.each([
    [1, 1, 1],
    [2, 2, 2],
    [3, 3, 3],
    [4, 4, 2],
    [5, 3, 3],
    [6, 3, 3],
    [7, 4, 2],
    [8, 4, 2],
    [9, 3, 3],
  ])('%i: %i per row on desktop, %i on a tablet', (count, desktop, tablet) => {
    expect(uspDesktopPerRow(count)).toBe(desktop);
    expect(uspTabletPerRow(count)).toBe(tablet);
  });

  it('gives one per row for no selling points', () => {
    expect(uspDesktopPerRow(0)).toBe(1);
    expect(uspTabletPerRow(0)).toBe(1);
  });
});

describe('readUsp', () => {
  const EMPTY = {
    backgroundColor: '',
    textColor: '',
    heading: '',
    description: '',
    items: [],
  };

  it.each([undefined, null, 'usp', 3, []])(
    'reads %j as an empty block',
    (raw) => {
      expect(readUsp(raw)).toEqual(EMPTY);
    },
  );

  it('reads the template shape', () => {
    expect(
      readUsp({
        templateId: 'usp',
        settings: { backgroundColor: '#0b2e4f', textColor: 'white' },
        header: { heading: 'Why us', description: 'Three reasons' },
        items: [
          {
            icon: 'local_shipping',
            heading: 'Fast delivery',
            description: 'Within 24 hours',
          },
        ],
      }),
    ).toEqual({
      backgroundColor: '#0b2e4f',
      textColor: 'white',
      heading: 'Why us',
      description: 'Three reasons',
      items: [
        {
          icon: ICON,
          heading: 'Fast delivery',
          description: 'Within 24 hours',
        },
      ],
    });
  });

  it('leaves empty and invalid colours empty', () => {
    expect(
      readUsp({ settings: { backgroundColor: '', textColor: 'red;x:y' } }),
    ).toMatchObject({ backgroundColor: '', textColor: '' });
  });

  it('reads fields that are not strings as empty', () => {
    expect(
      readUsp({
        header: { heading: 1, description: {} },
        items: [{ icon: 'eco', heading: 2, description: ['x'] }],
      }),
    ).toMatchObject({
      heading: '',
      description: '',
      items: [
        {
          icon: 'material-symbols:eco-outline-rounded',
          heading: '',
          description: '',
        },
      ],
    });
  });

  it('keeps a selling point with any one of its fields', () => {
    const { items } = readUsp({
      items: [
        { icon: 'eco' },
        { heading: 'Only a heading' },
        { description: 'Only a text' },
      ],
    });
    expect(items).toHaveLength(3);
  });

  it('drops entries that are not objects, or have nothing to show', () => {
    const { items } = readUsp({
      items: [
        null,
        'eco',
        {},
        { icon: '', heading: '', description: '' },
        { icon: 'bad;name' },
        { heading: 'Kept' },
      ],
    });
    expect(items).toEqual([{ icon: '', heading: 'Kept', description: '' }]);
  });

  it('reads items that are not a list as none', () => {
    expect(readUsp({ items: { icon: 'eco' } }).items).toEqual([]);
  });
});
