import { describe, it, expect } from 'vitest';
import type { ProductAsset } from '../../shared/types/commerce';
import {
  documentDownloadUrl,
  documentIconKind,
  formatDocumentSize,
  isViewableDocument,
  productDocuments,
  safeDocumentUrl,
} from '../../app/utils/product-documents';

function asset(overrides: Partial<ProductAsset> = {}): ProductAsset {
  return {
    id: 'a1',
    name: 'manual.pdf',
    url: 'https://cdn.example.com/documents/manual.pdf',
    linkType: 'productfile',
    sizeBytes: 37862,
    description: [],
    ...overrides,
  };
}

describe('productDocuments', () => {
  it('keeps only the files, in the order the API sends them', () => {
    const rows = productDocuments(
      [
        asset({ id: 'img', name: 'photo.jpg', linkType: 'productimage' }),
        asset({ id: 'b', name: 'b.docx' }),
        asset({ id: 'a', name: 'a.pdf' }),
      ],
      'en',
    );
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('names a file by its description in the page language', () => {
    const [row] = productDocuments(
      [
        asset({
          description: [
            { language: 'da', value: 'Produktblad (PDF)' },
            { language: 'en', value: 'Product data sheet (PDF)' },
          ],
        }),
      ],
      'en',
    );
    expect(row!.name).toBe('Product data sheet (PDF)');
    expect(row!.fileName).toBe('manual.pdf');
  });

  it('falls back to the file name, never to another language', () => {
    const [row] = productDocuments(
      [asset({ description: [{ language: 'en', value: 'Data sheet' }] })],
      'sv',
    );
    expect(row!.name).toBe('manual.pdf');
  });

  it('falls back to the file name on a blank description', () => {
    const [row] = productDocuments(
      [asset({ description: [{ language: 'sv', value: '  ' }] })],
      'sv',
    );
    expect(row!.name).toBe('manual.pdf');
  });

  it('falls back to the file name when there is no description list', () => {
    const [row] = productDocuments([asset({ description: null })], 'en');
    expect(row!.name).toBe('manual.pdf');
  });

  it('takes the type from the extension, lower case', () => {
    const rows = productDocuments(
      [
        asset({ name: 'Calibration.XLSX' }),
        asset({ name: 'pack.tar.gz' }),
        asset({ name: 'README' }),
      ],
      'en',
    );
    expect(rows.map((r) => r.fileType)).toEqual(['xlsx', 'gz', '']);
  });

  it('carries size and url through', () => {
    const [row] = productDocuments([asset()], 'en');
    expect(row!.sizeBytes).toBe(37862);
    expect(row!.url).toBe('https://cdn.example.com/documents/manual.pdf');
  });

  it('is empty for no assets', () => {
    expect(productDocuments(undefined, 'en')).toEqual([]);
    expect(productDocuments([], 'en')).toEqual([]);
  });
});

describe('safeDocumentUrl', () => {
  it('lets https and same-origin paths through', () => {
    expect(safeDocumentUrl('https://cdn.example.com/a.pdf')).toBe(
      'https://cdn.example.com/a.pdf',
    );
    expect(safeDocumentUrl('/docs/a.pdf')).toBe('/docs/a.pdf');
  });

  it('refuses anything else', () => {
    expect(safeDocumentUrl('//evil.example.com/a.pdf')).toBeNull();
    expect(safeDocumentUrl('http://cdn.example.com/a.pdf')).toBeNull();
    expect(safeDocumentUrl('javascript:alert(1)')).toBeNull();
    expect(safeDocumentUrl('')).toBeNull();
  });
});

describe('documentDownloadUrl', () => {
  it('asks the CDN for an attachment', () => {
    expect(
      documentDownloadUrl('https://cdn.example.com/acc/documents/a.pdf'),
    ).toBe('https://cdn.example.com/acc/documents/a.pdf?download=1');
  });

  it('appends to a query the url already has', () => {
    expect(documentDownloadUrl('https://cdn.example.com/a.pdf?v=2')).toBe(
      'https://cdn.example.com/a.pdf?v=2&download=1',
    );
  });

  it('keeps a fragment last', () => {
    expect(documentDownloadUrl('https://cdn.example.com/a.pdf#page=2')).toBe(
      'https://cdn.example.com/a.pdf?download=1#page=2',
    );
    expect(documentDownloadUrl('/docs/a.pdf?v=2#page=2')).toBe(
      '/docs/a.pdf?v=2&download=1#page=2',
    );
  });
});

describe('isViewableDocument', () => {
  it('is true for what the browser shows itself', () => {
    for (const type of ['pdf', 'png', 'jpg', 'jpeg', 'webp']) {
      expect(isViewableDocument(type)).toBe(true);
    }
  });

  it('is false for the rest', () => {
    for (const type of ['docx', 'xlsx', 'zip', 'svg', 'wav', '']) {
      expect(isViewableDocument(type)).toBe(false);
    }
  });
});

describe('documentIconKind', () => {
  it('says image, audio or text', () => {
    for (const type of ['png', 'jpg', 'jpeg', 'webp', 'svg']) {
      expect(documentIconKind(type)).toBe('image');
    }
    for (const type of ['mp3', 'wav', 'm4a', 'ogg']) {
      expect(documentIconKind(type)).toBe('audio');
    }
    expect(documentIconKind('pdf')).toBe('text');
    expect(documentIconKind('zip')).toBe('text');
  });
});

describe('formatDocumentSize', () => {
  it('rounds to whole kB below a megabyte, at least 1', () => {
    expect(formatDocumentSize(991, 'en')).toBe('1 kB');
    expect(formatDocumentSize(1, 'en')).toBe('1 kB');
    expect(formatDocumentSize(37862, 'en')).toBe('38 kB');
    expect(formatDocumentSize(999_999, 'en')).toBe('1,000 kB');
  });

  it('gives one decimal in MB from a megabyte, in the page locale', () => {
    expect(formatDocumentSize(1_000_000, 'en')).toBe('1 MB');
    expect(formatDocumentSize(2_310_000, 'en')).toBe('2.3 MB');
    expect(formatDocumentSize(2_310_000, 'sv')).toBe('2,3 MB');
  });
});
