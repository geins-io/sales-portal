import { defineStore } from 'pinia';
import { ListsSession, FAVORITES_LIST_ID } from '@geins/crm';
import type { ProductList } from '@geins/crm';
import type { StorageInterface } from '@geins/core';

class LocalStorageAdapter implements StorageInterface {
  get(key: string): string | undefined {
    return localStorage.getItem(key) ?? undefined;
  }

  set(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}

export const useFavoritesStore = defineStore('favorites', () => {
  const items = ref<string[]>([]);
  const count = computed(() => items.value.length);

  // All custom lists (excludes the built-in favorites list). Surfaces
  // the ListsSession state reactively so the AddToListDialog can render
  // + react to additions / removals without subscribing directly to the
  // SDK session.
  const lists = ref<ProductList[]>([]);
  const favorites = ref<ProductList | null>(null);

  let session: ListsSession | null = null;

  function getSession(): ListsSession | null {
    if (import.meta.server) return null;
    if (!session) {
      session = new ListsSession({ storage: new LocalStorageAdapter() });
    }
    return session;
  }

  function syncFromSession() {
    const s = getSession();
    if (!s) {
      items.value = [];
      lists.value = [];
      favorites.value = null;
      return;
    }
    const fav = s.favorites;
    favorites.value = fav;
    items.value = fav.items;
    lists.value = s.getLists().filter((l) => l.id !== FAVORITES_LIST_ID);
  }

  function initialize() {
    syncFromSession();
  }

  // Auto-initialize on client when store is first created
  if (import.meta.client) {
    initialize();
  }

  function toggle(productId: string): boolean {
    const s = getSession();
    if (!s) return false;
    const result = s.toggleFavorite(productId);
    syncFromSession();
    return result;
  }

  function add(productId: string) {
    const s = getSession();
    if (!s) return;
    s.addItem(FAVORITES_LIST_ID, productId);
    syncFromSession();
  }

  function remove(productId: string) {
    const s = getSession();
    if (!s) return;
    s.removeItem(FAVORITES_LIST_ID, productId);
    syncFromSession();
  }

  function clear() {
    const s = getSession();
    if (!s) return;
    s.clearItems(FAVORITES_LIST_ID);
    syncFromSession();
  }

  function isFavorite(productId: string): boolean {
    // Read from reactive items array so Vue tracks dependency changes
    return items.value.includes(productId);
  }

  // --- Custom list operations (backing the AddToListDialog) ---------------

  /**
   * Create a new custom list. Returns the created list, or null on
   * server render / empty name. Sync happens before the return value
   * so callers can immediately reference it in reactive state.
   */
  function createList(name: string): ProductList | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const s = getSession();
    if (!s) return null;
    const created = s.createList(trimmed);
    syncFromSession();
    return created;
  }

  /**
   * Add a product to a specific list. Accepts the built-in favorites
   * list id too, so the dialog can treat favorites uniformly.
   */
  function addItemToList(listId: string, productId: string) {
    const s = getSession();
    if (!s) return;
    s.addItem(listId, productId);
    syncFromSession();
  }

  /** Remove a product from a specific list. */
  function removeItemFromList(listId: string, productId: string) {
    const s = getSession();
    if (!s) return;
    s.removeItem(listId, productId);
    syncFromSession();
  }

  /** IDs of all lists that currently contain `productId`. */
  function productListIds(productId: string): string[] {
    const s = getSession();
    if (!s) return [];
    return s
      .getLists()
      .filter((l) => l.items.includes(productId))
      .map((l) => l.id);
  }

  /** Delete a custom list by id. No-op for the built-in favorites list. */
  function deleteList(listId: string) {
    if (listId === FAVORITES_LIST_ID) return;
    const s = getSession();
    if (!s) return;
    s.deleteList(listId);
    syncFromSession();
  }

  /** Rename a custom list. No-op for the built-in favorites list. */
  function renameList(listId: string, name: string) {
    if (listId === FAVORITES_LIST_ID) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const s = getSession();
    if (!s) return;
    s.renameList(listId, trimmed);
    syncFromSession();
  }

  /** Look up a single list by id (favorites or custom). */
  function getListById(listId: string): ProductList | null {
    if (listId === FAVORITES_LIST_ID) return favorites.value;
    return lists.value.find((l) => l.id === listId) ?? null;
  }

  return {
    items,
    count,
    lists,
    favorites,
    initialize,
    toggle,
    add,
    remove,
    clear,
    isFavorite,
    createList,
    addItemToList,
    removeItemFromList,
    productListIds,
    deleteList,
    renameList,
    getListById,
  };
});
