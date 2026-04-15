import { describe, it, expect } from 'vitest';
import { ref, nextTick } from 'vue';
import { usePagination } from '../../app/composables/usePagination';

describe('usePagination', () => {
  it('initialises currentPage at 1', () => {
    const source = ref<number[]>([]);
    const p = usePagination({
      source: () => source.value,
      pageSize: 20,
    });
    expect(p.currentPage.value).toBe(1);
  });

  it('computes totalPages from source length and pageSize', () => {
    const source = ref(Array.from({ length: 45 }, (_, i) => i));
    const p = usePagination({
      source: () => source.value,
      pageSize: 20,
    });
    expect(p.totalPages.value).toBe(3);
  });

  it('returns at least 1 totalPages when source is empty', () => {
    const source = ref<number[]>([]);
    const p = usePagination({
      source: () => source.value,
      pageSize: 20,
    });
    expect(p.totalPages.value).toBe(1);
  });

  it('paginatedItems returns the correct slice for the current page', () => {
    const source = ref(Array.from({ length: 45 }, (_, i) => i + 1));
    const p = usePagination({
      source: () => source.value,
      pageSize: 20,
    });
    p.goToPage(2);
    expect(p.paginatedItems.value).toEqual(
      Array.from({ length: 20 }, (_, i) => 21 + i),
    );
  });

  it('goToPage clamps to 1..totalPages and ignores out-of-range', () => {
    const source = ref(Array.from({ length: 45 }, (_, i) => i));
    const p = usePagination({
      source: () => source.value,
      pageSize: 20,
    });
    p.goToPage(0);
    expect(p.currentPage.value).toBe(1);
    p.goToPage(99);
    expect(p.currentPage.value).toBe(1);
    p.goToPage(3);
    expect(p.currentPage.value).toBe(3);
  });

  it('clamps currentPage down when totalPages shrinks', async () => {
    const source = ref(Array.from({ length: 45 }, (_, i) => i));
    const p = usePagination({
      source: () => source.value,
      pageSize: 20,
    });
    p.goToPage(3);
    expect(p.currentPage.value).toBe(3);
    source.value = Array.from({ length: 5 }, (_, i) => i);
    await nextTick();
    expect(p.currentPage.value).toBe(1);
  });

  it('resets currentPage to 1 when a watched reset source changes', async () => {
    const source = ref(Array.from({ length: 45 }, (_, i) => i));
    const query = ref('');
    const p = usePagination({
      source: () => source.value,
      pageSize: 20,
      resetOn: [() => query.value],
    });
    p.goToPage(2);
    expect(p.currentPage.value).toBe(2);
    query.value = 'shoe';
    await nextTick();
    expect(p.currentPage.value).toBe(1);
  });

  it('supports a reactive pageSize ref (recomputes totalPages)', async () => {
    const source = ref(Array.from({ length: 45 }, (_, i) => i));
    const pageSize = ref(10);
    const p = usePagination({
      source: () => source.value,
      pageSize,
    });
    expect(p.totalPages.value).toBe(5);
    pageSize.value = 20;
    await nextTick();
    expect(p.totalPages.value).toBe(3);
  });

  it('resets currentPage to 1 when reactive pageSize changes', async () => {
    const source = ref(Array.from({ length: 45 }, (_, i) => i));
    const pageSize = ref(10);
    const p = usePagination({
      source: () => source.value,
      pageSize,
    });
    p.goToPage(4);
    expect(p.currentPage.value).toBe(4);
    pageSize.value = 20;
    await nextTick();
    expect(p.currentPage.value).toBe(1);
  });

  it('showPagination is true only when source length exceeds pageSize', () => {
    const source = ref(Array.from({ length: 5 }, (_, i) => i));
    const p = usePagination({
      source: () => source.value,
      pageSize: 20,
    });
    expect(p.showPagination.value).toBe(false);
    source.value = Array.from({ length: 21 }, (_, i) => i);
    expect(p.showPagination.value).toBe(true);
  });
});
