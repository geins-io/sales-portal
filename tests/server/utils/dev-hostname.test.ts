import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsDevMode = vi.fn();
vi.mock('../../../server/utils/dev-mode', () => ({
  isDevMode: mockIsDevMode,
}));

const { devLookupHostname } =
  await import('../../../server/utils/dev-hostname');

// Sequential: the tests flip the dev-mode mock, which the file-level
// concurrency of the node tier would otherwise race.
describe.sequential('devLookupHostname', () => {
  beforeEach(() => {
    mockIsDevMode.mockReset();
  });

  it('rewrites a .litium.portal host to .litium.store in dev', () => {
    mockIsDevMode.mockReturnValue(true);
    expect(devLookupHostname('example.litium.portal')).toBe(
      'example.litium.store',
    );
  });

  it('leaves the hostname untouched outside dev', () => {
    mockIsDevMode.mockReturnValue(false);
    expect(devLookupHostname('example.litium.portal')).toBe(
      'example.litium.portal',
    );
  });

  it('leaves a host that does not end in .litium.portal untouched in dev', () => {
    mockIsDevMode.mockReturnValue(true);
    for (const hostname of [
      'example.litium.store',
      'shop.example.com',
      'localhost',
    ]) {
      expect(devLookupHostname(hostname), hostname).toBe(hostname);
    }
  });

  it('matches the suffix at the end only', () => {
    mockIsDevMode.mockReturnValue(true);
    // The suffix appears, but the host belongs to someone else.
    expect(devLookupHostname('litium.portal.example.com')).toBe(
      'litium.portal.example.com',
    );
    // The bare domain carries no tenant name to rewrite.
    expect(devLookupHostname('litium.portal')).toBe('litium.portal');
  });

  it('swaps only the tail of a deeper name', () => {
    mockIsDevMode.mockReturnValue(true);
    expect(devLookupHostname('preview.example.litium.portal')).toBe(
      'preview.example.litium.store',
    );
  });
});
