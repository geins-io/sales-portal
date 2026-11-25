/**
 * Cards Rich (Create widget template `cards-rich`): reads the block's settings
 * and each card from both data shapes. Blocks saved from the current template
 * group a card as `text`, `image` and `button`, with the block's settings in
 * `settings`; blocks saved earlier hold flat cards with `cta` and no settings.
 */

export type CardsPerRow = 1 | 2 | 3 | 4;

export interface CardsRichCard {
  heading: string;
  description: string;
  /** null when no image is uploaded: the card has no image area. */
  image: { src: string; srcPath: string | null; alt: string } | null;
  button: { text: string; url: string } | null;
  buttonStyle: 'button' | 'link';
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  /** '' = none, the card's own colours. Otherwise a validated CSS colour. */
  backgroundColor: string;
  textColor: string;
}

type Raw = Record<string, unknown>;

function record(value: unknown): Raw | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Raw)
    : undefined;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? (value as T) : allowed[0]!;
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// Numeric arguments only: no nested function, no `;`, no quotes, so the value
// cannot add a declaration to the card's style attribute.
const COLOR_FUNCTION =
  /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\((?:[\d.+\-%,/\s]|deg|turn|g?rad|none)+\)$/i;
const COLOR_NAME = /^[a-z]+$/i;
const MAX_COLOR_LENGTH = 64;

/** The merchant's colour when it is a plain CSS colour, else '' (none). */
export function cssColor(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const value = raw.trim();
  if (value.length > MAX_COLOR_LENGTH) return '';
  return HEX.test(value) || COLOR_FUNCTION.test(value) || COLOR_NAME.test(value)
    ? value
    : '';
}

export function readCardsRichCard(raw: unknown): CardsRichCard {
  const card = record(raw) ?? {};
  const text = record(card.text) ?? {};
  const imageData = record(card.image) ?? {};
  const buttonData = record(card.button) ?? record(card.cta);
  const src = str(imageData.src);
  const buttonText = str(buttonData?.text);
  const buttonUrl = str(buttonData?.url);

  return {
    heading: str(text.heading) || str(card.heading),
    description: str(text.description) || str(card.description),
    image: src
      ? {
          src,
          srcPath:
            typeof imageData.srcPath === 'string' ? imageData.srcPath : null,
          alt: str(imageData.alt),
        }
      : null,
    button:
      buttonText || buttonUrl ? { text: buttonText, url: buttonUrl } : null,
    buttonStyle: oneOf(record(card.button)?.buttonStyle, [
      'button',
      'link',
    ] as const),
    textAlign: oneOf(text.textAlign, ['left', 'center', 'right'] as const),
    verticalAlign: oneOf(text.verticalAlign, [
      'top',
      'center',
      'bottom',
    ] as const),
    backgroundColor: cssColor(text.backgroundColor),
    textColor: cssColor(text.textColor),
  };
}

/**
 * Cards per row from `md` up. A select saves "3", so strings count. Without a
 * fixed value the count decides, as before the setting: 1–2 cards two per
 * row, more three.
 */
export function cardsRichPerRow(settings: unknown, count: number): CardsPerRow {
  const value = record(settings)?.cardsPerRow;
  if (typeof value === 'number' || typeof value === 'string') {
    const fixed = Number(value);
    if (fixed === 1 || fixed === 2 || fixed === 3 || fixed === 4) return fixed;
  }
  return count <= 2 ? 2 : 3;
}

/** Space between the cards; Merchant Center saves the switch as a boolean. */
export function cardsRichSpacing(settings: unknown): boolean {
  return record(settings)?.spacing !== false;
}
