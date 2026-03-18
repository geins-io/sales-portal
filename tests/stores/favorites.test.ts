import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const mockSession = {
  favorites: {
    items: [] as string[],
    id: '__favorites__',
    name: 'Favorites',
    createdAt: '',
    updatedAt: '',
  },
  isFavorite: vi.fn<(id: string) => boolean>().mockReturnValue(false),
  addItem: vi.fn(),
  removeItem: vi.fn(),
  toggleFavorite: vi.fn<(id: string) => boolean>().mockReturnValue(true),
  clearItems: vi.fn(),
  count: 0,
};

vi.mock('@geins/crm', () => ({
  ListsSession: vi.fn().mockImplementation(() => mockSession),
  FAVORITES_LIST_ID: '__favorites__',
}));

// Must import after mocks
const { useFavoritesStore } = await import('../../app/stores/favorites');

describe('useFavoritesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockSession.favorites.items = [];
    mockSession.isFavorite.mockReturnValue(false);
    mockSession.toggleFavorite.mockReturnValue(true);
    mockSession.count = 0;
  });

  describe('initial state', () => {
    it('has empty items and zero count', () => {
      const store = useFavoritesStore();

      expect(store.items).toEqual([]);
      expect(store.count).toBe(0);
    });
  });

  describe('initialize', () => {
    it('populates items from session', () => {
      mockSession.favorites.items = ['prod-1', 'prod-2'];
      mockSession.count = 2;

      const store = useFavoritesStore();
      store.initialize();

      expect(store.items).toEqual(['prod-1', 'prod-2']);
      expect(store.count).toBe(2);
    });

    it('is a noop on server', () => {
      // Simulate server environment
      const originalServer = import.meta.server;
      Object.defineProperty(import.meta, 'server', {
        value: true,
        writable: true,
        configurable: true,
      });

      const store = useFavoritesStore();
      store.initialize();

      expect(store.items).toEqual([]);

      Object.defineProperty(import.meta, 'server', {
        value: originalServer,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('toggle', () => {
    it('adds product and syncs state', () => {
      mockSession.toggleFavorite.mockReturnValue(true);
      mockSession.favorites.items = ['prod-1'];
      mockSession.count = 1;

      const store = useFavoritesStore();
      store.initialize();
      const result = store.toggle('prod-1');

      expect(mockSession.toggleFavorite).toHaveBeenCalledWith('prod-1');
      expect(result).toBe(true);
      expect(store.items).toEqual(['prod-1']);
    });

    it('removes product and syncs state', () => {
      mockSession.favorites.items = ['prod-1'];
      mockSession.count = 1;

      const store = useFavoritesStore();
      store.initialize();

      // Now toggle removes it
      mockSession.toggleFavorite.mockReturnValue(false);
      mockSession.favorites.items = [];
      mockSession.count = 0;

      const result = store.toggle('prod-1');

      expect(mockSession.toggleFavorite).toHaveBeenCalledWith('prod-1');
      expect(result).toBe(false);
      expect(store.items).toEqual([]);
      expect(store.count).toBe(0);
    });
  });

  describe('add', () => {
    it('calls session.addItem and syncs', () => {
      mockSession.favorites.items = ['prod-1'];
      mockSession.count = 1;

      const store = useFavoritesStore();
      store.add('prod-1');

      expect(mockSession.addItem).toHaveBeenCalledWith(
        '__favorites__',
        'prod-1',
      );
      expect(store.items).toEqual(['prod-1']);
    });
  });

  describe('remove', () => {
    it('calls session.removeItem and syncs', () => {
      mockSession.favorites.items = ['prod-1'];
      mockSession.count = 1;

      const store = useFavoritesStore();
      store.initialize();

      mockSession.favorites.items = [];
      mockSession.count = 0;

      store.remove('prod-1');

      expect(mockSession.removeItem).toHaveBeenCalledWith(
        '__favorites__',
        'prod-1',
      );
      expect(store.items).toEqual([]);
      expect(store.count).toBe(0);
    });
  });

  describe('clear', () => {
    it('calls session.clearItems and syncs', () => {
      mockSession.favorites.items = ['prod-1', 'prod-2'];
      mockSession.count = 2;

      const store = useFavoritesStore();
      store.initialize();

      mockSession.favorites.items = [];
      mockSession.count = 0;

      store.clear();

      expect(mockSession.clearItems).toHaveBeenCalledWith('__favorites__');
      expect(store.items).toEqual([]);
      expect(store.count).toBe(0);
    });
  });

  describe('isFavorite', () => {
    it('returns true when items include the product', () => {
      mockSession.favorites.items = ['prod-1', 'prod-3'];

      const store = useFavoritesStore();
      store.initialize();

      expect(store.isFavorite('prod-1')).toBe(true);
    });

    it('returns false when items do not include the product', () => {
      mockSession.favorites.items = ['prod-1'];

      const store = useFavoritesStore();
      store.initialize();

      expect(store.isFavorite('prod-2')).toBe(false);
    });
  });

  describe('count', () => {
    it('reflects items length', () => {
      mockSession.favorites.items = ['a', 'b', 'c'];
      mockSession.count = 3;

      const store = useFavoritesStore();
      store.initialize();

      expect(store.count).toBe(3);
    });
  });
});
