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
 * Build a mailto: URL from a recipient, subject, and list of labelled fields.
 *
 * Body format: one "Label: value" line per field, joined with \r\n
 * (which encodes to %0D%0A in the URL).
 */
export function buildMailto({
  recipient,
  subject,
  fields,
}: BuildMailtoOptions): string {
  const bodyLines = fields.map((f) => `${f.label}: ${f.value}`);
  const bodyText = bodyLines.join('\r\n');

  const encodedRecipient = encodeURIComponent(recipient);
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(bodyText);

  return `mailto:${encodedRecipient}?subject=${encodedSubject}&body=${encodedBody}`;
}
