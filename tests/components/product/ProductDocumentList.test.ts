import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductDocumentList from '../../../app/components/product/ProductDocumentList.vue';
import ProductDocumentsPanel from '../../../app/components/product/ProductDocumentsPanel.vue';
import { productDocuments } from '../../../app/utils/product-documents';
import type { ProductAsset } from '../../../shared/types/commerce';

const CDN = 'https://cdn.example.com/documents';

/** The shape product 1084 carries: no Swedish descriptions, five files. */
const ASSETS: ProductAsset[] = [
  {
    id: 'img',
    name: 'photo.jpg',
    url: `${CDN}/photo.jpg`,
    linkType: 'productimage',
    sizeBytes: 79984,
    description: [],
  },
  {
    id: 'docx',
    name: 'manual.docx',
    url: `${CDN}/manual.docx`,
    linkType: 'productfile',
    sizeBytes: 991,
    description: [{ language: 'en', value: 'User manual (Word)' }],
  },
  {
    id: 'pdf',
    name: 'sheet.pdf',
    url: `${CDN}/sheet.pdf`,
    linkType: 'productfile',
    sizeBytes: 2_310_000,
    description: [{ language: 'en', value: 'Product data sheet (PDF)' }],
  },
  {
    id: 'zip',
    name: 'pack.zip',
    url: `${CDN}/pack.zip`,
    linkType: 'productfile',
    sizeBytes: 31897,
    description: [],
  },
];

function mountList(language = 'en') {
  return mountComponent(ProductDocumentList, {
    props: { documents: productDocuments(ASSETS, language) },
  });
}

describe('ProductDocumentList', () => {
  it('lists the files only, in API order, named in the page language', () => {
    const rows = mountList().findAll('[data-testid="product-document"]');
    expect(rows.map((r) => r.find('.font-medium').text())).toEqual([
      'User manual (Word)',
      'Product data sheet (PDF)',
      'pack.zip',
    ]);
  });

  it('falls back to the file name when the page language has no description', () => {
    const rows = mountList('sv').findAll('[data-testid="product-document"]');
    expect(rows.map((r) => r.find('.font-medium').text())).toEqual([
      'manual.docx',
      'sheet.pdf',
      'pack.zip',
    ]);
  });

  it('says type and size, without a language', () => {
    const metas = mountList()
      .findAll('[data-testid="product-document-meta"]')
      .map((m) => m.text());
    expect(metas).toEqual(['DOCX · 1 kB', 'PDF · 2.3 MB', 'ZIP · 32 kB']);
  });

  it('offers View, in a new tab, only for what the browser can show', () => {
    const wrapper = mountList();
    const views = wrapper.findAll('[data-testid="product-document-view"]');
    expect(views).toHaveLength(1);
    expect(views[0]!.attributes('href')).toBe(`${CDN}/sheet.pdf`);
    expect(views[0]!.attributes('target')).toBe('_blank');

    const open = wrapper.findAll('[data-testid="product-document-open"]');
    expect(open.map((a) => a.attributes('href'))).toEqual([`${CDN}/sheet.pdf`]);
  });

  it('downloads every file as an attachment under its own name', () => {
    const downloads = mountList().findAll(
      '[data-testid="product-document-download"]',
    );
    expect(downloads.map((a) => a.attributes('href'))).toEqual([
      `${CDN}/manual.docx?download=1`,
      `${CDN}/sheet.pdf?download=1`,
      `${CDN}/pack.zip?download=1`,
    ]);
    expect(downloads.map((a) => a.attributes('download'))).toEqual([
      'manual.docx',
      'sheet.pdf',
      'pack.zip',
    ]);
    // Saved in place, not opened in a tab.
    expect(downloads.some((a) => a.attributes('target'))).toBe(false);
  });

  it('gives no links to a file with an unsafe url', () => {
    const wrapper = mountComponent(ProductDocumentList, {
      props: {
        documents: productDocuments(
          [{ ...ASSETS[2]!, url: 'http://cdn.example.com/sheet.pdf' }],
          'en',
        ),
      },
    });
    expect(wrapper.findAll('a')).toHaveLength(0);
    expect(wrapper.find('[data-testid="product-document"]').text()).toContain(
      'Product data sheet (PDF)',
    );
  });
});

describe('ProductDocumentsPanel', () => {
  it('lists the files under the heading', () => {
    const wrapper = mountComponent(ProductDocumentsPanel, {
      props: { documents: productDocuments(ASSETS, 'en') },
      global: { components: { ProductDocumentList } },
    });
    expect(wrapper.find('h3').text()).toBe('product.documents');
    expect(wrapper.findAll('[data-testid="product-document"]')).toHaveLength(3);
    expect(wrapper.text()).not.toContain('product.no_documents');
  });

  it('says there are none when the product has no files', () => {
    const wrapper = mountComponent(ProductDocumentsPanel, {
      props: { documents: [] },
      global: { components: { ProductDocumentList } },
    });
    expect(wrapper.text()).toContain('product.no_documents');
    expect(wrapper.find('[data-testid="product-documents"]').exists()).toBe(
      false,
    );
  });
});
