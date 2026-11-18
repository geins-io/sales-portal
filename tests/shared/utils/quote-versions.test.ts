import { describe, it, expect } from 'vitest';
import { versionNames } from '../../../shared/utils/quote-versions';

/** A version as the quotation carries it: newest first, the request without `validFrom`. */
function version(quoteNumber: string, validFrom: string | null) {
  return { quotationId: `id-${quoteNumber}`, quoteNumber, validFrom };
}

describe('versionNames', () => {
  it('names the request as the request and each offer by its number', () => {
    const names = versionNames([
      version('2611-2-0503-01', '2026-11-16T12:52:43Z'),
      version('2611-2-0503-00', null),
    ]);
    expect([...names]).toEqual([
      ['id-2611-2-0503-01', { kind: 'offer', number: '2611-2-0503-01' }],
      ['id-2611-2-0503-00', { kind: 'request' }],
    ]);
  });

  it('names every version of a quotation the seller started by its number', () => {
    const names = versionNames([
      version('2611-2-1044-01', '2026-11-18T12:15:28Z'),
      version('2611-2-1044-00', '2026-11-18T12:15:27Z'),
    ]);
    expect(names.get('id-2611-2-1044-00')).toEqual({
      kind: 'offer',
      number: '2611-2-1044-00',
    });
    expect(names.get('id-2611-2-1044-01')).toEqual({
      kind: 'offer',
      number: '2611-2-1044-01',
    });
  });

  it('reads an entry without validFrom as the request', () => {
    const names = versionNames([{ quotationId: 'q-00', quoteNumber: 'n' }]);
    expect(names.get('q-00')).toEqual({ kind: 'request' });
  });

  it('keeps an offer without a shown number as one without', () => {
    const names = versionNames([version('', '2026-11-18T10:00:00Z')]);
    expect(names.get('id-')).toEqual({ kind: 'offer', number: '' });
  });

  it('gives no names without versions', () => {
    expect(versionNames([]).size).toBe(0);
    expect(versionNames(null).size).toBe(0);
    expect(versionNames(undefined).size).toBe(0);
  });
});
