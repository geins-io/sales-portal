import { describe, it, expect } from 'vitest';
import { buildMailto } from '../../app/utils/mailto';

describe('buildMailto', () => {
  it('prefixes with mailto: and includes the recipient', () => {
    const result = buildMailto({
      recipient: 'test@example.com',
      subject: 'Hello',
      fields: [],
    });
    expect(result).toMatch(/^mailto:/);
    expect(result).toContain(encodeURIComponent('test@example.com'));
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
});
