// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';

const KEY = 'saved-list-quantities';

type List = { id: string; name: string; items: string[] };

let sessionLists: List[] = [];

const mockSession = {
  get favorites() {
    return sessionLists.find((l) => l.id === '__favorites__')!;
  },
  getLists: () => sessionLists,
  addItem: vi.fn((listId: string, alias: string) => {
    sessionLists.find((l) => l.id === listId)?.items.push(alias);
  }),
  removeItem: vi.fn((listId: string, alias: string) => {
    const list = sessionLists.find((l) => l.id === listId);
    if (list) list.items = list.items.filter((a) => a !== alias);
  }),
  deleteList: vi.fn((listId: string) => {
    sessionLists = sessionLists.filter((l) => l.id !== listId);
  }),
};

vi.mock('@geins/crm', () => ({
  ListsSession: vi.fn().mockImplementation(() => mockSession),
  FAVORITES_LIST_ID: '__favorites__',
}));

const { useFavoritesStore } = await import('../../app/stores/favorites');

function stored(): unknown {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('useFavoritesStore quantities', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    sessionLists = [
      { id: '__favorites__', name: 'Favorites', items: [] },
      { id: 'list-1', name: 'One', items: ['alpha', 'beta'] },
      { id: 'list-2', name: 'Two', items: ['alpha'] },
    ];
  });

  it('reads 1 for a list saved before quantities existed', () => {
    const store = useFavoritesStore();
    store.initialize();

    expect(store.getQuantity('list-1', 'alpha')).toBe(1);
    expect(localStorage.getItem(KEY)).not.toContain('alpha');
  });

  it('persists a quantity per list and alias', async () => {
    const store = useFavoritesStore();
    store.initialize();

    store.setQuantity('list-1', 'alpha', 4);
    await nextTick();

    expect(store.getQuantity('list-1', 'alpha')).toBe(4);
    expect(store.getQuantity('list-2', 'alpha')).toBe(1);
    expect(stored()).toEqual({ 'list-1': { alpha: 4 } });
  });

  it('stores nothing for a quantity of 1', async () => {
    const store = useFavoritesStore();
    store.initialize();

    store.setQuantity('list-1', 'alpha', 3);
    store.setQuantity('list-1', 'alpha', 1);
    await nextTick();

    expect(stored()).toEqual({});
  });

  it('clamps a quantity below 1 or not a whole number', () => {
    const store = useFavoritesStore();
    store.initialize();

    store.setQuantity('list-1', 'alpha', 0);
    expect(store.getQuantity('list-1', 'alpha')).toBe(1);
    store.setQuantity('list-1', 'alpha', 2.7);
    expect(store.getQuantity('list-1', 'alpha')).toBe(2);
    store.setQuantity('list-1', 'alpha', Number.NaN);
    expect(store.getQuantity('list-1', 'alpha')).toBe(1);
  });

  it('reads 1 for a stored value that is not a whole number >= 1', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ 'list-1': { alpha: 'x', beta: -2 } }),
    );
    const store = useFavoritesStore();

    expect(store.getQuantity('list-1', 'alpha')).toBe(1);
    expect(store.getQuantity('list-1', 'beta')).toBe(1);
  });

  it('reads a quantity stored by an earlier page load', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'list-1': { beta: 6 } }));
    const store = useFavoritesStore();
    store.initialize();

    expect(store.getQuantity('list-1', 'beta')).toBe(6);
  });

  it('drops the quantity of a removed item, so re-adding starts at 1', async () => {
    const store = useFavoritesStore();
    store.initialize();
    store.setQuantity('list-1', 'alpha', 5);
    store.setQuantity('list-1', 'beta', 2);

    store.removeItemFromList('list-1', 'alpha');
    await nextTick();
    expect(stored()).toEqual({ 'list-1': { beta: 2 } });

    store.addItemToList('list-1', 'alpha');
    expect(store.getQuantity('list-1', 'alpha')).toBe(1);
  });

  it('drops every quantity of a deleted list', async () => {
    const store = useFavoritesStore();
    store.initialize();
    store.setQuantity('list-1', 'alpha', 5);
    store.setQuantity('list-2', 'alpha', 3);

    store.deleteList('list-1');
    await nextTick();

    expect(stored()).toEqual({ 'list-2': { alpha: 3 } });
  });

  it('drops quantities orphaned while the page was closed', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ gone: { alpha: 2 }, 'list-1': { removed: 3, beta: 4 } }),
    );
    const store = useFavoritesStore();
    store.initialize();
    await nextTick();

    expect(stored()).toEqual({ 'list-1': { beta: 4 } });
  });
});
