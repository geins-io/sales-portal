/**
 * Formats a record timestamp (order placed, invoice date) in the tenant's
 * own operating timezone, not the server's OS timezone or the viewer's
 * browser. Anchoring to the tenant's timezone keeps "which day" a single,
 * agreed fact for a business record — the server-OS-dependent version of
 * this shifted the displayed date depending on where the process happened
 * to run. See docs/adr/024-tenant-operating-timezone.md.
 *
 * Deliberately not for deadline/cutoff-style timestamps ("order before
 * 14:00") — those are more useful converted to the viewer's own clock,
 * which is the opposite of what this does on purpose.
 */
export function formatTenantDate(
  dateStr: string | number | null | undefined,
  timezone: string,
  locale = 'sv-SE',
): string {
  if (dateStr == null) return '-';
  try {
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone,
    });
  } catch {
    return String(dateStr);
  }
}
