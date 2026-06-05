import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, type ComputedRef } from 'vue';
import { mountComponent } from '../../utils/component';
import ProductListWidget from '../../../app/components/cms/widgets/ProductListWidget.vue';

// Capture the options passed to useFetch so we can assert the query the widget
// builds. The widget resolves its language server-side from request context,
// but the active locale/market must still be part of the query key so the
// fetch (and CDN cache) is keyed per locale — otherwise a language switch
// reuses the previous locale's cached products (SAL-256).
const calls: Array<Record<string, unknown>> = [];
const mockUseFetch = vi.fn((_url: unknown, opts?: Record<string, unknown>) => {
  if (opts) calls.push(opts);
  return { data: ref({ products: [], count: 0 }) };
});

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...(args as [unknown])),
}));
vi.stubGlobal('useFetch', (...args: unknown[]) =>
  mockUseFetch(...(args as [unknown])),
);

function makeProps(searchParameters?: Record<string, unknown>) {
  return {
    data: {
      title: 'Featured',
      pageCount: 1,
      ...(searchParameters ? { searchParameters } : {}),
    },
    config: {
      name: 'test',
      displayName: 'Featured',
      active: true,
      type: 'ProductListWidget',
      size: 'full',
      sortOrder: 0,
    },
    layout: 'full',
  };
}

function resolveQuery(): Record<string, unknown> {
  const query = calls[0]?.query as
    | ComputedRef<Record<string, unknown>>
    | Record<string, unknown>
    | (() => Record<string, unknown>)
    | undefined;
  if (typeof query === 'function') return query();
  if (query && 'value' in query)
    return (query as ComputedRef<Record<string, unknown>>).value;
  return (query as Record<string, unknown>) ?? {};
}

describe('ProductListWidget', () => {
  beforeEach(() => {
    calls.length = 0;
    mockUseFetch.mockClear();
  });

  it('keys the product fetch by the active locale and market', () => {
    mountComponent(ProductListWidget, { props: makeProps() });
    const query = resolveQuery();
    // The locale + market from the active route must reach the query so the
    // useFetch key changes on language switch and the CDN cache does not
    // serve a different locale's response.
    expect(query.locale).toBe('en');
    expect(query.market).toBe('se');
    // Existing behaviour preserved.
    expect(query.take).toBe(4);
    expect(query.skip).toBe(0);
  });

  it('still forwards the curated CMS filter alongside the locale', () => {
    const params = { searchText: 'cable' };
    mountComponent(ProductListWidget, { props: makeProps(params) });
    const query = resolveQuery();
    expect(query.filter).toBe(JSON.stringify(params));
    expect(query.locale).toBe('en');
    expect(query.market).toBe('se');
  });
});
