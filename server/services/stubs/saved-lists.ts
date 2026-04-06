import type { SavedList, SavedListItem } from '#shared/types/saved-list';
import type {
  CreateSavedListInput,
  UpdateSavedListInput,
} from '../../schemas/api-input';

// ---------------------------------------------------------------------------
// Mutable in-memory state
// ---------------------------------------------------------------------------
let lists: SavedList[];

function createStubData() {
  const now = new Date().toISOString();

  const officeSuppliesItems: SavedListItem[] = [
    {
      id: crypto.randomUUID(),
      productId: 1001,
      sku: 'DESK-OAK-160',
      name: 'Oak Standing Desk 160cm',
      articleNumber: 'FRN-1001',
      quantity: 2,
      unitPrice: 4990,
      unitPriceFormatted: '4 990 SEK',
      imageUrl: '/images/products/desk-oak.jpg',
    },
    {
      id: crypto.randomUUID(),
      productId: 1002,
      sku: 'CHAIR-ERG-BLK',
      name: 'Ergonomic Office Chair Black',
      articleNumber: 'FRN-1002',
      quantity: 4,
      unitPrice: 3490,
      unitPriceFormatted: '3 490 SEK',
      imageUrl: '/images/products/chair-erg.jpg',
    },
  ];

  const warehouseItems: SavedListItem[] = [
    {
      id: crypto.randomUUID(),
      productId: 2001,
      sku: 'SHELF-STL-200',
      name: 'Steel Storage Shelf 200cm',
      articleNumber: 'WH-2001',
      quantity: 10,
      unitPrice: 1290,
      unitPriceFormatted: '1 290 SEK',
    },
    {
      id: crypto.randomUUID(),
      productId: 2002,
      sku: 'PALLET-WRAP-500',
      name: 'Pallet Wrap 500m Roll',
      articleNumber: 'WH-2002',
      quantity: 20,
      unitPrice: 189,
      unitPriceFormatted: '189 SEK',
    },
    {
      id: crypto.randomUUID(),
      productId: 2003,
      sku: 'LABEL-THERM-1000',
      name: 'Thermal Labels 1000pcs',
      articleNumber: 'WH-2003',
      quantity: 5,
      unitPrice: 149,
      unitPriceFormatted: '149 SEK',
    },
  ];

  lists = [
    {
      id: crypto.randomUUID(),
      userId: 'user-admin-001',
      name: 'Office Furniture Q2',
      description: 'Standing desks and chairs for the new Stockholm office',
      items: officeSuppliesItems,
      createdBy: 'user-admin-001',
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      userId: 'user-admin-001',
      name: 'Warehouse Supplies',
      description: 'Monthly restock for Gothenburg warehouse',
      items: warehouseItems,
      createdBy: 'user-admin-001',
      createdAt: '2026-02-15T08:30:00Z',
      updatedAt: now,
    },
  ];
}

// Initialize on module load
createStubData();

// ---------------------------------------------------------------------------
// Stub functions
// ---------------------------------------------------------------------------

/** TODO: Replace stub with Geins API -- GET /lists?userId={userId} */
export function getListsStub(userId: string): SavedList[] {
  return lists
    .filter((l) => l.userId === userId)
    .map((l) => ({ ...l, items: l.items.map((i) => ({ ...i })) }));
}

/** TODO: Replace stub with Geins API -- GET /lists/{id} */
export function getListStub(listId: string, userId: string): SavedList {
  const list = lists.find((l) => l.id === listId && l.userId === userId);
  if (!list) {
    throw createAppError(ErrorCode.NOT_FOUND, `List ${listId} not found`);
  }
  return { ...list, items: list.items.map((i) => ({ ...i })) };
}

/** TODO: Replace stub with Geins API -- POST /lists */
export function createListStub(
  userId: string,
  data: CreateSavedListInput,
): SavedList {
  const now = new Date().toISOString();
  const items: SavedListItem[] = (data.items ?? []).map((item) => ({
    ...item,
    id: crypto.randomUUID(),
  }));
  const list: SavedList = {
    id: crypto.randomUUID(),
    userId,
    name: data.name,
    description: data.description,
    items,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  lists.push(list);
  return { ...list, items: list.items.map((i) => ({ ...i })) };
}

/** TODO: Replace stub with Geins API -- PUT /lists/{id} */
export function updateListStub(
  listId: string,
  userId: string,
  data: UpdateSavedListInput,
): SavedList {
  const list = lists.find((l) => l.id === listId && l.userId === userId);
  if (!list) {
    throw createAppError(ErrorCode.NOT_FOUND, `List ${listId} not found`);
  }

  if (data.name !== undefined) list.name = data.name;
  if (data.description !== undefined) list.description = data.description;
  if (data.items !== undefined) {
    list.items = data.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));
  }
  list.updatedAt = new Date().toISOString();

  return { ...list, items: list.items.map((i) => ({ ...i })) };
}

/** TODO: Replace stub with Geins API -- DELETE /lists/{id} */
export function deleteListStub(listId: string, userId: string): void {
  const idx = lists.findIndex((l) => l.id === listId && l.userId === userId);
  if (idx === -1) {
    throw createAppError(ErrorCode.NOT_FOUND, `List ${listId} not found`);
  }
  lists.splice(idx, 1);
}
