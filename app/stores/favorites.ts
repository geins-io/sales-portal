import { defineStore } from 'pinia';
import { ListsSession, FAVORITES_LIST_ID } from '@geins/crm';
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
    items.value = s ? s.favorites.items : [];
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

  return {
    items,
    count,
    initialize,
    toggle,
    add,
    remove,
    clear,
    isFavorite,
  };
});
