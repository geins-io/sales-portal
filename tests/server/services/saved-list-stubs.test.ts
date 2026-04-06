import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub Nitro auto-imports used by the saved list stubs
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, message: string) => {
    const err = new Error(message);
    (err as Error & { statusCode: number }).statusCode =
      code === 'NOT_FOUND' ? 404 : 400;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
});

describe('saved list service stubs', () => {
  let stubs: typeof import('../../../server/services/stubs/saved-lists');

  beforeEach(async () => {
    vi.resetModules();
    stubs = await import('../../../server/services/stubs/saved-lists');
  });

  // -----------------------------------------------------------------------
  // getListsStub
  // -----------------------------------------------------------------------
  describe('getListsStub', () => {
    it('returns lists for the known user', () => {
      const lists = stubs.getListsStub('user-admin-001');

      expect(lists).toHaveLength(2);
      expect(lists[0].name).toBe('Office Furniture Q2');
      expect(lists[1].name).toBe('Warehouse Supplies');
    });

    it('returns empty array for unknown user', () => {
      const lists = stubs.getListsStub('unknown-user');

      expect(lists).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // getListStub
  // -----------------------------------------------------------------------
  describe('getListStub', () => {
    it('returns a list by ID for the correct user', () => {
      const lists = stubs.getListsStub('user-admin-001');
      const list = stubs.getListStub(lists[0].id, 'user-admin-001');

      expect(list.id).toBe(lists[0].id);
      expect(list.name).toBe('Office Furniture Q2');
      expect(list.items).toHaveLength(2);
    });

    it('throws 404 for unknown list ID', () => {
      expect(() => stubs.getListStub('nonexistent', 'user-admin-001')).toThrow(
        'List nonexistent not found',
      );
    });

    it('throws 404 when list belongs to different user', () => {
      const lists = stubs.getListsStub('user-admin-001');

      expect(() => stubs.getListStub(lists[0].id, 'other-user')).toThrow(
        'not found',
      );
    });
  });

  // -----------------------------------------------------------------------
  // createListStub
  // -----------------------------------------------------------------------
  describe('createListStub', () => {
    it('creates a new list with UUID id and timestamps', () => {
      const list = stubs.createListStub('user-admin-001', {
        name: 'Test List',
        description: 'A test list',
      });

      expect(list.id).toBeDefined();
      expect(list.name).toBe('Test List');
      expect(list.description).toBe('A test list');
      expect(list.userId).toBe('user-admin-001');
      expect(list.createdBy).toBe('user-admin-001');
      expect(list.createdAt).toBeDefined();
      expect(list.updatedAt).toBeDefined();
      expect(list.items).toEqual([]);
    });

    it('creates a list with items', () => {
      const list = stubs.createListStub('user-admin-001', {
        name: 'With Items',
        items: [
          {
            productId: 100,
            sku: 'SKU-100',
            name: 'Product A',
            articleNumber: 'ART-100',
            quantity: 3,
            unitPrice: 500,
            unitPriceFormatted: '500 SEK',
          },
        ],
      });

      expect(list.items).toHaveLength(1);
      expect(list.items[0].id).toBeDefined();
      expect(list.items[0].sku).toBe('SKU-100');
    });

    it('adds the new list to the store', () => {
      const before = stubs.getListsStub('user-admin-001');
      stubs.createListStub('user-admin-001', { name: 'Extra' });
      const after = stubs.getListsStub('user-admin-001');

      expect(after).toHaveLength(before.length + 1);
    });
  });

  // -----------------------------------------------------------------------
  // updateListStub
  // -----------------------------------------------------------------------
  describe('updateListStub', () => {
    it('updates name and description', () => {
      const lists = stubs.getListsStub('user-admin-001');
      const updated = stubs.updateListStub(lists[0].id, 'user-admin-001', {
        name: 'Renamed',
        description: 'New description',
      });

      expect(updated.name).toBe('Renamed');
      expect(updated.description).toBe('New description');
    });

    it('updates items array', () => {
      const lists = stubs.getListsStub('user-admin-001');
      const updated = stubs.updateListStub(lists[0].id, 'user-admin-001', {
        items: [
          {
            productId: 999,
            sku: 'NEW-SKU',
            name: 'New Product',
            articleNumber: 'NEW-ART',
            quantity: 1,
            unitPrice: 100,
            unitPriceFormatted: '100 SEK',
          },
        ],
      });

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].sku).toBe('NEW-SKU');
    });

    it('updates the updatedAt timestamp', () => {
      const lists = stubs.getListsStub('user-admin-001');
      const original = lists[0];
      const updated = stubs.updateListStub(original.id, 'user-admin-001', {
        name: 'Time Check',
      });

      expect(updated.updatedAt).not.toBe(original.createdAt);
    });

    it('throws 404 for unknown list', () => {
      expect(() =>
        stubs.updateListStub('bad-id', 'user-admin-001', { name: 'X' }),
      ).toThrow('List bad-id not found');
    });
  });

  // -----------------------------------------------------------------------
  // deleteListStub
  // -----------------------------------------------------------------------
  describe('deleteListStub', () => {
    it('removes the list', () => {
      const lists = stubs.getListsStub('user-admin-001');
      stubs.deleteListStub(lists[0].id, 'user-admin-001');

      expect(stubs.getListsStub('user-admin-001')).toHaveLength(
        lists.length - 1,
      );
    });

    it('throws 404 for unknown list', () => {
      expect(() => stubs.deleteListStub('ghost', 'user-admin-001')).toThrow(
        'List ghost not found',
      );
    });

    it('throws 404 when list belongs to different user', () => {
      const lists = stubs.getListsStub('user-admin-001');

      expect(() => stubs.deleteListStub(lists[0].id, 'other-user')).toThrow(
        'not found',
      );
    });
  });
});
