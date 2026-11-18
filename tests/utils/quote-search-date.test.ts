import { describe, it, expect } from 'vitest';
import {
  searchDateFormat,
  searchDateRange,
} from '../../app/utils/quote-search-date';

const STOCKHOLM = 'Europe/Stockholm';

/** The day 2026-11-12 in Stockholm, winter time. */
const NOV_12 = {
  createdFrom: '2026-11-12T00:00:00+01:00',
  createdBefore: '2026-11-13T00:00:00+01:00',
};

describe('searchDateRange', () => {
  describe('a day as the list shows it', () => {
    it.each([
      ['sv-SE', '2026-11-12'],
      ['de-DE', '12.11.2026'],
      ['fi-FI', '12.11.2026'],
      ['da-DK', '12.11.2026'],
      ['nb-NO', '12.11.2026'],
      ['en-GB', '12/11/2026'],
      ['en-US', '11/12/2026'],
    ])('reads %s %s as that whole day', (locale, term) => {
      expect(searchDateRange(term, locale, STOCKHOLM)).toEqual(NOV_12);
    });

    it('reads the day and month without a leading zero too', () => {
      expect(searchDateRange('2.3.2026', 'de-DE', STOCKHOLM)).toEqual({
        createdFrom: '2026-03-02T00:00:00+01:00',
        createdBefore: '2026-03-03T00:00:00+01:00',
      });
    });

    it('reads YYYY-MM-DD in every language', () => {
      for (const locale of ['de-DE', 'en-GB', 'en-US', 'fi-FI']) {
        expect(searchDateRange('2026-11-12', locale, STOCKHOLM)).toEqual(
          NOV_12,
        );
      }
    });

    it("does not read another language's shape", () => {
      expect(searchDateRange('12.11.2026', 'sv-SE', STOCKHOLM)).toBeNull();
      expect(searchDateRange('12/11/2026', 'de-DE', STOCKHOLM)).toBeNull();
    });

    it('ignores the space around the term', () => {
      expect(searchDateRange('  2026-11-12 ', 'sv-SE', STOCKHOLM)).toEqual(
        NOV_12,
      );
    });
  });

  describe('a month', () => {
    it('reads YYYY-MM as the whole month', () => {
      expect(searchDateRange('2026-11', 'sv-SE', STOCKHOLM)).toEqual({
        createdFrom: '2026-11-01T00:00:00+01:00',
        createdBefore: '2026-12-01T00:00:00+01:00',
      });
    });

    it('reads January, the first month', () => {
      expect(searchDateRange('2026-01', 'sv-SE', STOCKHOLM)).toEqual({
        createdFrom: '2026-01-01T00:00:00+01:00',
        createdBefore: '2026-02-01T00:00:00+01:00',
      });
    });

    it('ends December at the new year', () => {
      expect(searchDateRange('2026-12', 'de-DE', STOCKHOLM)).toEqual({
        createdFrom: '2026-12-01T00:00:00+01:00',
        createdBefore: '2027-01-01T00:00:00+01:00',
      });
    });
  });

  describe('the bounds are midnight where the list writes its dates', () => {
    it('in summer time', () => {
      expect(searchDateRange('2026-07-01', 'sv-SE', STOCKHOLM)).toEqual({
        createdFrom: '2026-07-01T00:00:00+02:00',
        createdBefore: '2026-07-02T00:00:00+02:00',
      });
    });

    it('across the night the clocks go forward', () => {
      expect(searchDateRange('2026-03-29', 'sv-SE', STOCKHOLM)).toEqual({
        createdFrom: '2026-03-29T00:00:00+01:00',
        createdBefore: '2026-03-30T00:00:00+02:00',
      });
    });

    it('across the month the clocks go back', () => {
      expect(searchDateRange('2026-10', 'sv-SE', STOCKHOLM)).toEqual({
        createdFrom: '2026-10-01T00:00:00+02:00',
        createdBefore: '2026-11-01T00:00:00+01:00',
      });
    });

    it('where the clocks change between local and UTC midnight', () => {
      // Sydney leaves summer time at 03:00 on 5 April, 16:00 UTC the day
      // before: its midnight is still +11:00, UTC midnight already +10:00.
      expect(
        searchDateRange('2026-04-05', 'sv-SE', 'Australia/Sydney'),
      ).toEqual({
        createdFrom: '2026-04-05T00:00:00+11:00',
        createdBefore: '2026-04-06T00:00:00+10:00',
      });
    });

    it('in a zone with minutes in its offset, and in UTC', () => {
      expect(searchDateRange('2026-11-12', 'sv-SE', 'Asia/Kolkata')).toEqual({
        createdFrom: '2026-11-12T00:00:00+05:30',
        createdBefore: '2026-11-13T00:00:00+05:30',
      });
      expect(searchDateRange('2026-11-12', 'sv-SE', 'UTC')).toEqual({
        createdFrom: '2026-11-12T00:00:00+00:00',
        createdBefore: '2026-11-13T00:00:00+00:00',
      });
    });

    it('west of UTC', () => {
      expect(
        searchDateRange('2026-11-12', 'sv-SE', 'America/New_York'),
      ).toEqual({
        createdFrom: '2026-11-12T00:00:00-05:00',
        createdBefore: '2026-11-13T00:00:00-05:00',
      });
    });

    it("in the browser's own zone when the tenant names none", () => {
      const offset = (date: Date) => {
        const minutes = -date.getTimezoneOffset();
        const sign = minutes < 0 ? '-' : '+';
        const abs = Math.abs(minutes);
        return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
      };

      expect(searchDateRange('2026-11-12', 'sv-SE')).toEqual({
        createdFrom: `2026-11-12T00:00:00${offset(new Date(2026, 10, 12))}`,
        createdBefore: `2026-11-13T00:00:00${offset(new Date(2026, 10, 13))}`,
      });
    });
  });

  describe('anything else is a search for text', () => {
    it.each([
      ['a name', 'Varukorg 12 nov. 2026'],
      ['a quotation number', '2611-2-0370-00'],
      ['a date with text', '2026-11-12 offert'],
      ['text with a date', 'offert 2026-11-12'],
      ['text with a month', 'offert 2026-11'],
      ['text with a date as the language writes it', 'Lager 12.11.2026'],
      ['a day in a month that does not exist', '2026-13-01'],
      ['a year alone', '2026'],
      ['a day that does not exist', '2026-02-30'],
      ['a day past the month', '31.11.2026'],
      ['a month that does not exist', '2026-13'],
      ['a month zero', '2026-00'],
      ['day zero', '2026-11-00'],
      ['nothing', '   '],
    ])('%s', (_label, term) => {
      expect(searchDateRange(term, 'de-DE', STOCKHOLM)).toBeNull();
    });
  });
});

describe('searchDateFormat', () => {
  it.each([
    ['sv-SE', { year: 'ÅÅÅÅ', month: 'MM', day: 'DD' }, 'ÅÅÅÅ-MM-DD'],
    ['de-DE', { year: 'JJJJ', month: 'MM', day: 'TT' }, 'TT.MM.JJJJ'],
    ['en-GB', { year: 'YYYY', month: 'MM', day: 'DD' }, 'DD/MM/YYYY'],
    ['en-US', { year: 'YYYY', month: 'MM', day: 'DD' }, 'MM/DD/YYYY'],
  ])('names the shape %s shows', (locale, letters, expected) => {
    expect(searchDateFormat(locale, letters)).toBe(expected);
  });
});
