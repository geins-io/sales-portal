import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const mockSession = {
  getAll: vi.fn<() => string[]>().mockReturnValue([]),
  has: vi.fn<(id: string) => boolean>().mockReturnValue(false),
  add: vi.fn(),
  remove: vi.fn(),
  toggle: vi.fn<(id: string) => boolean>().mockReturnValue(true),
  clear: vi.fn(),
  count: 0,
};

vi.mock('@geins/crm', () => ({
  FavoritesSession: vi.fn().mockImplementation(() => mockSession),
}));

// Must import after mocks
const { useFavoritesStore } = await import('../../app/stores/favorites');

describe('useFavoritesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockSession.getAll.mockReturnValue([]);
    mockSession.has.mockReturnValue(false);
    mockSession.toggle.mockReturnValue(true);
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
      mockSession.getAll.mockReturnValue(['prod-1', 'prod-2']);
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
      mockSession.toggle.mockReturnValue(true);
      mockSession.getAll.mockReturnValue(['prod-1']);
      mockSession.count = 1;

      const store = useFavoritesStore();
      store.initialize();
      const result = store.toggle('prod-1');

      expect(mockSession.toggle).toHaveBeenCalledWith('prod-1');
      expect(result).toBe(true);
      expect(store.items).toEqual(['prod-1']);
    });

    it('removes product and syncs state', () => {
      mockSession.getAll.mockReturnValue(['prod-1']);
      mockSession.count = 1;

      const store = useFavoritesStore();
      store.initialize();

      // Now toggle removes it
      mockSession.toggle.mockReturnValue(false);
      mockSession.getAll.mockReturnValue([]);
      mockSession.count = 0;

      const result = store.toggle('prod-1');

      expect(mockSession.toggle).toHaveBeenCalledWith('prod-1');
      expect(result).toBe(false);
      expect(store.items).toEqual([]);
      expect(store.count).toBe(0);
    });
  });

  describe('add', () => {
    it('calls session.add and syncs', () => {
      mockSession.getAll.mockReturnValue(['prod-1']);
      mockSession.count = 1;

      const store = useFavoritesStore();
      store.add('prod-1');

      expect(mockSession.add).toHaveBeenCalledWith('prod-1');
      expect(store.items).toEqual(['prod-1']);
    });
  });

  describe('remove', () => {
    it('calls session.remove and syncs', () => {
      mockSession.getAll.mockReturnValue(['prod-1']);
      mockSession.count = 1;

      const store = useFavoritesStore();
      store.initialize();

      mockSession.getAll.mockReturnValue([]);
      mockSession.count = 0;

      store.remove('prod-1');

      expect(mockSession.remove).toHaveBeenCalledWith('prod-1');
      expect(store.items).toEqual([]);
      expect(store.count).toBe(0);
    });
  });

  describe('clear', () => {
    it('calls session.clear and syncs', () => {
      mockSession.getAll.mockReturnValue(['prod-1', 'prod-2']);
      mockSession.count = 2;

      const store = useFavoritesStore();
      store.initialize();

      mockSession.getAll.mockReturnValue([]);
      mockSession.count = 0;

      store.clear();

      expect(mockSession.clear).toHaveBeenCalled();
      expect(store.items).toEqual([]);
      expect(store.count).toBe(0);
    });
  });

  describe('isFavorite', () => {
    it('returns true when session has the product', () => {
      mockSession.has.mockReturnValue(true);

      const store = useFavoritesStore();
      store.initialize();

      expect(store.isFavorite('prod-1')).toBe(true);
      expect(mockSession.has).toHaveBeenCalledWith('prod-1');
    });

    it('returns false when session does not have the product', () => {
      mockSession.has.mockReturnValue(false);

      const store = useFavoritesStore();
      store.initialize();

      expect(store.isFavorite('prod-2')).toBe(false);
      expect(mockSession.has).toHaveBeenCalledWith('prod-2');
    });
  });

  describe('count', () => {
    it('reflects items length', () => {
      mockSession.getAll.mockReturnValue(['a', 'b', 'c']);
      mockSession.count = 3;

      const store = useFavoritesStore();
      store.initialize();

      expect(store.count).toBe(3);
    });
  });
});
