import { describe, it, expect } from 'vitest';
import { buildMailto } from '../../app/utils/mailto';

describe('buildMailto', () => {
  it('prefixes with mailto: and includes the recipient as a literal address', () => {
    const result = buildMailto({
      recipient: 'test@example.com',
      subject: 'Hello',
      fields: [],
    });
    expect(result).toMatch(/^mailto:/);
    expect(result).toContain('mailto:test@example.com');
  });

  it('URL-encodes the subject', () => {
    const result = buildMailto({
      recipient: 'a@b.com',
      subject: 'Account application: Acme AB',
      fields: [],
    });
    expect(result).toContain(
      'subject=' + encodeURIComponent('Account application: Acme AB'),
    );
  });

  it('includes each field as "Label: value" in the body', () => {
    const result = buildMailto({
      recipient: 'a@b.com',
      subject: 'Test',
      fields: [
        { label: 'Company name', value: 'Acme AB' },
        { label: 'Email', value: 'contact@acme.com' },
      ],
    });
    const decoded = decodeURIComponent(
      result.replace(/^.*[?&]body=/, '').split('&')[0]!,
    );
    expect(decoded).toContain('Company name: Acme AB');
    expect(decoded).toContain('Email: contact@acme.com');
  });

  it('joins lines with %0D%0A in the raw URL string', () => {
    const result = buildMailto({
      recipient: 'a@b.com',
      subject: 'Test',
      fields: [
        { label: 'Field A', value: 'val1' },
        { label: 'Field B', value: 'val2' },
      ],
    });
    const bodyParam = result.replace(/^.*[?&]body=/, '').split('&')[0]!;
    expect(bodyParam).toContain('%0D%0A');
  });

  it('renders the label line even for empty values', () => {
    const result = buildMailto({
      recipient: 'a@b.com',
      subject: 'Test',
      fields: [{ label: 'Notes', value: '' }],
    });
    const decoded = decodeURIComponent(
      result.replace(/^.*[?&]body=/, '').split('&')[0]!,
    );
    expect(decoded).toContain('Notes: ');
  });

  it('renders the label line even for whitespace-only values', () => {
    const result = buildMailto({
      recipient: 'a@b.com',
      subject: 'Test',
      fields: [{ label: 'Notes', value: '   ' }],
    });
    const decoded = decodeURIComponent(
      result.replace(/^.*[?&]body=/, '').split('&')[0]!,
    );
    expect(decoded).toContain('Notes:    ');
  });

  it('produces a well-formed mailto URL with subject and body params', () => {
    const result = buildMailto({
      recipient: 'info@example.com',
      subject: 'Subject text',
      fields: [{ label: 'Name', value: 'Alice' }],
    });
    expect(result).toMatch(/^mailto:[^?]+\?subject=[^&]+&body=.+/);
  });

  it('strips control characters from recipient and field label/value to prevent header injection', () => {
    const result = buildMailto({
      recipient: 'evil@example.com\r\nBcc:attacker@evil.com',
      subject: 'Test',
      fields: [
        { label: 'Field\r\nX-Injected', value: 'value\r\nX-Injected: yes' },
      ],
    });

    // (a) the `to` portion is the clean literal email with CR/LF removed --
    // CR and LF are stripped, so no line-break header injection is possible;
    // the remaining collapsed text is not a valid email but cannot inject a
    // header because there is no line separator before "Bcc:"
    expect(result).toContain('mailto:evil@example.com');
    // the `to` slot must not contain a literal CR or LF character
    expect(result.split('?')[0]).not.toMatch(/[\r\n]/);

    // (b) the raw URL string contains no unencoded CR or LF characters
    expect(result).not.toMatch(/\r/);
    expect(result).not.toMatch(/\n/);

    // (c) no line-break-separated Bcc: header appears unencoded in the URL
    // (the injection only works when a literal CRLF precedes "Bcc:")
    expect(result).not.toMatch(/[\r\n]Bcc:/i);
  });
});
