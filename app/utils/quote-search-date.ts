/** A created range as Geins filters quotations: from inclusive, before exclusive. */
export interface QuoteCreatedRange {
  createdFrom: string;
  createdBefore: string;
}

type DatePart = 'year' | 'month' | 'day';
type ShapePiece = { part: DatePart } | { literal: string };

/** The options the quotation list writes its dates with. */
const LIST_DATE: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

/** The parts of a date in the order `locale` writes them, with what lies between. */
function dateShape(locale: string): ShapePiece[] {
  return new Intl.DateTimeFormat(locale, LIST_DATE)
    .formatToParts(new Date(Date.UTC(2026, 10, 12)))
    .map(({ type, value }): ShapePiece =>
      type === 'year' || type === 'month' || type === 'day'
        ? { part: type as DatePart }
        : { literal: value },
    );
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The term as the date shape `locale` shows, or null. */
function readLocaleDate(term: string, locale: string) {
  const order: DatePart[] = [];
  const pattern = dateShape(locale)
    .map((piece) => {
      if ('literal' in piece) return escapeRegExp(piece.literal);
      order.push(piece.part);
      return piece.part === 'year' ? '(\\d{4})' : '(\\d{1,2})';
    })
    .join('');
  const match = new RegExp(`^${pattern}$`).exec(term);
  if (!match) return null;
  const at = (part: DatePart) => Number(match[order.indexOf(part) + 1]);
  return { year: at('year'), month: at('month'), day: at('day') };
}

/** Minutes `timeZone` (or the runtime's zone) is ahead of UTC at `instant`. */
function offsetMinutesAt(
  instant: number,
  timeZone: string | undefined,
): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wallClock = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
  );
  return (wallClock - instant) / 60_000;
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** Midnight starting a calendar day in `timeZone`, written with its offset. */
function midnight(
  year: number,
  month: number,
  day: number,
  timeZone: string | undefined,
): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  // The offset of midnight itself: read at UTC midnight, then again at the
  // local midnight that offset points to, in case a clock change lies between.
  const guess = offsetMinutesAt(date.getTime(), timeZone);
  const offset = offsetMinutesAt(date.getTime() - guess * 60_000, timeZone);
  const abs = Math.abs(offset);
  return (
    `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-` +
    `${pad(date.getUTCDate())}T00:00:00${offset < 0 ? '-' : '+'}` +
    `${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** True when the day exists: an overflow in the day or the month moves the month. */
function isDay(year: number, month: number, day: number): boolean {
  return new Date(Date.UTC(year, month - 1, day)).getUTCMonth() === month - 1;
}

/**
 * The created range a search term names, or null when it is not a date and
 * goes to the text search. A day as the list shows it for `locale`, or
 * `YYYY-MM-DD` in any language, is that day; `YYYY-MM` is the month. The
 * bounds are midnight in `timeZone`, the zone the list writes its dates in;
 * without one, the runtime's own.
 */
export function searchDateRange(
  term: string,
  locale: string,
  timeZone?: string,
): QuoteCreatedRange | null {
  const text = term.trim();

  const month = /^(\d{4})-(\d{2})$/.exec(text);
  if (month) {
    const year = Number(month[1]);
    const m = Number(month[2]);
    if (m < 1 || m > 12) return null;
    return {
      createdFrom: midnight(year, m, 1, timeZone),
      createdBefore: midnight(year, m + 1, 1, timeZone),
    };
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : readLocaleDate(text, locale);
  if (!date || !isDay(date.year, date.month, date.day)) return null;
  return {
    createdFrom: midnight(date.year, date.month, date.day, timeZone),
    createdBefore: midnight(date.year, date.month, date.day + 1, timeZone),
  };
}

/** The date shape the list shows for `locale`, written with `letters`, e.g. ÅÅÅÅ-MM-DD. */
export function searchDateFormat(
  locale: string,
  letters: Record<DatePart, string>,
): string {
  return dateShape(locale)
    .map((piece) => ('literal' in piece ? piece.literal : letters[piece.part]))
    .join('');
}
