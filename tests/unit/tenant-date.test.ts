import { describe, it, expect } from 'vitest';
import { formatTenantDate } from '../../app/utils/tenant-date';

describe('formatTenantDate', () => {
  it('returns "-" for a missing date', () => {
    expect(formatTenantDate(undefined, 'UTC')).toBe('-');
    expect(formatTenantDate(null, 'UTC')).toBe('-');
  });

  it('formats using the given timezone, not the process timezone', () => {
    // 23:30 UTC is already the next day in a timezone ahead of UTC.
    const iso = '2025-12-22T23:30:00Z';
    expect(formatTenantDate(iso, 'UTC')).toBe('2025-12-22');
    expect(formatTenantDate(iso, 'Pacific/Auckland')).toBe('2025-12-23');
  });

  it('resolves DST correctly for the same IANA zone across seasons', () => {
    // Stockholm is UTC+1 in December (CET) and UTC+2 in June (CEST) — an
    // IANA identifier resolves both correctly without any DST math here.
    expect(formatTenantDate('2025-12-22T22:30:00Z', 'Europe/Stockholm')).toBe(
      '2025-12-22',
    );
    expect(formatTenantDate('2025-12-22T23:30:00Z', 'Europe/Stockholm')).toBe(
      '2025-12-23',
    );
    expect(formatTenantDate('2025-06-22T21:30:00Z', 'Europe/Stockholm')).toBe(
      '2025-06-22',
    );
    expect(formatTenantDate('2025-06-22T22:30:00Z', 'Europe/Stockholm')).toBe(
      '2025-06-23',
    );
  });

  // toLocaleDateString doesn't throw on an invalid date, it returns the
  // string "Invalid Date" — the try/catch here (inherited from the inline
  // formatDate() this was extracted from) only actually catches an
  // unsupported timeZone identifier, not a bad date string.
  it('returns "Invalid Date" rather than throwing for an unparseable date', () => {
    expect(formatTenantDate('not-a-date', 'UTC')).toBe('Invalid Date');
  });

  it('falls back to the raw date string for an unsupported timezone identifier', () => {
    expect(formatTenantDate('2025-12-22T12:00:00Z', 'Not/AZone')).toBe(
      '2025-12-22T12:00:00Z',
    );
  });

  // SDK ProductList.updatedAt is a numeric epoch (Date.now()), not an ISO
  // string — portal/index.vue's stat cards format that directly.
  it('accepts a numeric epoch timestamp, not just an ISO string', () => {
    const epoch = Date.UTC(2025, 11, 22, 23, 30);
    expect(formatTenantDate(epoch, 'UTC')).toBe('2025-12-22');
  });
});
