/**
 * Pure mailto URL builder. No DOM access, SSR-safe.
 *
 * Builds a mailto: URL with URL-encoded subject and body.
 * Body lines are joined with \r\n before encoding, which yields
 * %0D%0A in the final URL string.
 */

export interface MailtoField {
  label: string;
  value: string;
}

export interface BuildMailtoOptions {
  recipient: string;
  subject: string;
  fields: MailtoField[];
}

/**
 * Strip ASCII control characters (U+0000-U+001F and U+007F) from a string.
 * Spaces and other printable characters are preserved as-is.
 */
function stripControlChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Build a mailto: URL from a recipient, subject, and list of labelled fields.
 *
 * The recipient is placed literal (not percent-encoded) per RFC 6068.
 * It is trimmed and stripped of ASCII control characters before insertion.
 *
 * Body format: one "Label: value" line per field, joined with \r\n
 * (which encodes to %0D%0A in the URL).
 */
export function buildMailto({
  recipient,
  subject,
  fields,
}: BuildMailtoOptions): string {
  const safeRecipient = stripControlChars(recipient.trim());

  const bodyLines = fields.map(
    (f) => `${stripControlChars(f.label)}: ${stripControlChars(f.value)}`,
  );
  const bodyText = bodyLines.join('\r\n');

  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(bodyText);

  return `mailto:${safeRecipient}?subject=${encodedSubject}&body=${encodedBody}`;
}
