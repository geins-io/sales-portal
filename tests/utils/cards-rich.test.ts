import { describe, it, expect } from 'vitest';
import {
  cardsRichPerRow,
  cardsRichSpacing,
  cssColor,
  readCardsRichCard,
} from '../../app/utils/cards-rich';

const EMPTY_CARD = {
  heading: '',
  description: '',
  image: null,
  button: null,
  buttonStyle: 'button',
  textAlign: 'left',
  verticalAlign: 'top',
  backgroundColor: '',
  textColor: '',
};

describe('readCardsRichCard', () => {
  it('reads the grouped shape Merchant Center saves', () => {
    expect(
      readCardsRichCard({
        text: {
          heading: 'Rent',
          description: 'By the day',
          textAlign: 'center',
          verticalAlign: 'bottom',
          backgroundColor: '#1e3a5f',
          textColor: '#ffffff',
        },
        image: { src: 'a.jpg', srcPath: 'content/a.jpg', alt: 'A' },
        button: { text: 'Read more', url: '/rent', buttonStyle: 'link' },
      }),
    ).toEqual({
      heading: 'Rent',
      description: 'By the day',
      image: { src: 'a.jpg', srcPath: 'content/a.jpg', alt: 'A' },
      button: { text: 'Read more', url: '/rent' },
      buttonStyle: 'link',
      textAlign: 'center',
      verticalAlign: 'bottom',
      backgroundColor: '#1e3a5f',
      textColor: '#ffffff',
    });
  });

  it('reads the flat shape with cta that existing blocks hold', () => {
    expect(
      readCardsRichCard({
        heading: 'Service',
        description: 'We fix it',
        image: { src: 'b.jpg', srcPath: 'content/b.jpg', alt: 'B' },
        cta: { text: 'Book', url: '/service' },
      }),
    ).toEqual({
      ...EMPTY_CARD,
      heading: 'Service',
      description: 'We fix it',
      image: { src: 'b.jpg', srcPath: 'content/b.jpg', alt: 'B' },
      button: { text: 'Book', url: '/service' },
    });
  });

  it('takes the grouped text over flat fields, and button over cta', () => {
    const card = readCardsRichCard({
      heading: 'flat',
      description: 'flat',
      text: { heading: 'grouped', description: 'grouped' },
      cta: { text: 'old', url: '/old' },
      button: { text: 'new', url: '/new' },
    });
    expect(card.heading).toBe('grouped');
    expect(card.description).toBe('grouped');
    expect(card.button).toEqual({ text: 'new', url: '/new' });
  });

  it('falls back to the flat fields when the text group leaves them out', () => {
    const card = readCardsRichCard({
      heading: 'flat heading',
      description: 'flat text',
      text: { textAlign: 'right' },
    });
    expect(card.heading).toBe('flat heading');
    expect(card.description).toBe('flat text');
    expect(card.textAlign).toBe('right');
  });

  it('reads alignments, colours and button style only from the groups', () => {
    const card = readCardsRichCard({
      heading: 'A',
      textAlign: 'center',
      verticalAlign: 'bottom',
      backgroundColor: '#000',
      textColor: '#fff',
      buttonStyle: 'link',
      cta: { text: 'Go', url: '/a', buttonStyle: 'link' },
    });
    expect(card.textAlign).toBe('left');
    expect(card.verticalAlign).toBe('top');
    expect(card.backgroundColor).toBe('');
    expect(card.textColor).toBe('');
    expect(card.buttonStyle).toBe('button');
  });

  it.each(['left', 'center', 'right'])('keeps textAlign %s', (value) => {
    expect(readCardsRichCard({ text: { textAlign: value } }).textAlign).toBe(
      value,
    );
  });

  it.each(['top', 'center', 'bottom'])('keeps verticalAlign %s', (value) => {
    expect(
      readCardsRichCard({ text: { verticalAlign: value } }).verticalAlign,
    ).toBe(value);
  });

  it('falls back to the defaults for unknown values', () => {
    const card = readCardsRichCard({
      text: {
        textAlign: 'justify',
        verticalAlign: 'middle',
        backgroundColor: 'red; background:url(x)',
        textColor: 3,
      },
      button: { text: 'Go', url: '/a', buttonStyle: 'ghost' },
    });
    expect(card.textAlign).toBe('left');
    expect(card.verticalAlign).toBe('top');
    expect(card.backgroundColor).toBe('');
    expect(card.textColor).toBe('');
    expect(card.buttonStyle).toBe('button');
  });

  it('shows no image without a src', () => {
    expect(readCardsRichCard({ image: { src: '', alt: 'x' } }).image).toBe(
      null,
    );
    expect(readCardsRichCard({ image: { alt: 'x' } }).image).toBe(null);
    expect(readCardsRichCard({ image: 'a.jpg' }).image).toBe(null);
  });

  it('defaults the alt text, and a srcPath that is not a string to null', () => {
    expect(readCardsRichCard({ image: { src: 'a.jpg' } }).image).toEqual({
      src: 'a.jpg',
      srcPath: null,
      alt: '',
    });
    expect(
      readCardsRichCard({ image: { src: 'a.jpg', srcPath: 3 } }).image,
    ).toEqual({ src: 'a.jpg', srcPath: null, alt: '' });
    expect(
      readCardsRichCard({ image: { src: 'a.jpg', srcPath: null } }).image,
    ).toEqual({ src: 'a.jpg', srcPath: null, alt: '' });
  });

  it('has no button when the group is empty or not an object', () => {
    expect(readCardsRichCard({ button: { text: '', url: '' } }).button).toBe(
      null,
    );
    expect(readCardsRichCard({ cta: 'Go' }).button).toBe(null);
    expect(readCardsRichCard({}).button).toBe(null);
  });

  it('keeps a button that has only a url or only a text', () => {
    expect(readCardsRichCard({ button: { url: '/a' } }).button).toEqual({
      text: '',
      url: '/a',
    });
    expect(readCardsRichCard({ cta: { text: 'Go' } }).button).toEqual({
      text: 'Go',
      url: '',
    });
  });

  it('reads the button style even when the button has no text or url', () => {
    expect(
      readCardsRichCard({ button: { text: '', url: '', buttonStyle: 'link' } })
        .buttonStyle,
    ).toBe('link');
  });

  it('reads non-string fields as empty', () => {
    expect(
      readCardsRichCard({
        text: { heading: 1, description: { a: 1 } },
        button: { text: 2, url: 3 },
        image: { src: 4, alt: 5 },
      }),
    ).toEqual(EMPTY_CARD);
  });

  it.each([null, undefined, 'card', 3, []])(
    'reads %j as an empty card',
    (raw) => {
      expect(readCardsRichCard(raw)).toEqual(EMPTY_CARD);
    },
  );
});

describe('cardsRichPerRow', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['3', 3],
    ['4', 4],
    [1, 1],
    [4, 4],
  ])('fixes %j per row, whatever the count', (value, expected) => {
    expect(cardsRichPerRow({ cardsPerRow: value }, 1)).toBe(expected);
    expect(cardsRichPerRow({ cardsPerRow: value }, 6)).toBe(expected);
  });

  it.each(['dynamic', undefined, '5', 0, '0', 'abc', 2.5, null, true, ''])(
    'lets the count decide for %j',
    (value) => {
      expect(cardsRichPerRow({ cardsPerRow: value }, 1)).toBe(2);
      expect(cardsRichPerRow({ cardsPerRow: value }, 4)).toBe(3);
    },
  );

  it.each([
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 3],
    [4, 3],
    [7, 3],
  ])('dynamic with %i cards gives %i per row, as today', (count, expected) => {
    expect(cardsRichPerRow(undefined, count)).toBe(expected);
    expect(cardsRichPerRow({}, count)).toBe(expected);
    expect(cardsRichPerRow('3', count)).toBe(expected);
  });
});

describe('cardsRichSpacing', () => {
  it('is on unless the switch is off', () => {
    expect(cardsRichSpacing(undefined)).toBe(true);
    expect(cardsRichSpacing({})).toBe(true);
    expect(cardsRichSpacing({ spacing: true })).toBe(true);
    expect(cardsRichSpacing({ spacing: 'false' })).toBe(true);
    expect(cardsRichSpacing({ spacing: 0 })).toBe(true);
    expect(cardsRichSpacing({ spacing: false })).toBe(false);
  });
});

describe('cssColor', () => {
  it.each([
    '#fff',
    '#FFFA',
    '#1e3a5f',
    '#1E3A5F80',
    'rgb(30, 58, 95)',
    'rgba(30,58,95,0.5)',
    'rgb(30 58 95 / 50%)',
    'hsl(210deg 52% 24%)',
    'hsla(210, 52%, 24%, .5)',
    'oklch(0.35 0.07 250)',
    'oklch(0.35 0.07 250 / 0.8)',
    'lab(29% -2 -24)',
    'hwb(210 12% 63%)',
    'oklch(0.5 none 0.5turn)',
    'hsl(1.2rad 50% 50%)',
    'hsl(100grad 50% 50%)',
    'white',
    'rebeccapurple',
    'transparent',
  ])('keeps %s', (value) => {
    expect(cssColor(value)).toBe(value);
  });

  it('trims the value', () => {
    expect(cssColor('  #1e3a5f \n')).toBe('#1e3a5f');
  });

  it.each([
    '',
    '   ',
    '#ff',
    '#fffff',
    '#1e3a5g',
    '1e3a5f',
    'x#fff',
    '#fffx',
    'red; background:url(x)',
    'red;',
    'url(x)',
    'var(--primary)',
    'rgb(1,2,3);',
    'rgb(1,2,3) ;',
    'rgb(1,2,var(--x))',
    'rgb()',
    'rgb(1,2,3',
    'rgb(1,2,3)x',
    'xrgb(1,2,3)',
    'expression(alert(1))',
    'calc(1px)',
    'rgb(1, 2, "3")',
    'red blue',
    'red-ish',
    '"red"',
    'r3d',
  ])('drops %j', (value) => {
    expect(cssColor(value)).toBe('');
  });

  it('drops a value longer than any colour', () => {
    const long = `rgb(${'1 '.repeat(40)})`;
    expect(long.trim().length).toBeGreaterThan(64);
    expect(cssColor(long)).toBe('');
    expect(cssColor('a'.repeat(64))).toBe('a'.repeat(64));
    expect(cssColor('a'.repeat(65))).toBe('');
  });

  it.each([undefined, null, 0, 1, true, {}, ['#fff']])(
    'drops the non-string %j',
    (value) => {
      expect(cssColor(value)).toBe('');
    },
  );
});
