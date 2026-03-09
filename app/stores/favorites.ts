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

  function getSession(): ListsSession {
    if (!session) {
      session = new ListsSession({ storage: new LocalStorageAdapter() });
    }
    return session;
  }

  function syncFromSession() {
    items.value = getSession().favorites.items;
  }

  function initialize() {
    if (import.meta.server) return;
    syncFromSession();
  }

  function toggle(productId: string): boolean {
    const result = getSession().toggleFavorite(productId);
    syncFromSession();
    return result;
  }

  function add(productId: string) {
    getSession().addItem(FAVORITES_LIST_ID, productId);
    syncFromSession();
  }

  function remove(productId: string) {
    getSession().removeItem(FAVORITES_LIST_ID, productId);
    syncFromSession();
  }

  function clear() {
    getSession().clearItems(FAVORITES_LIST_ID);
    syncFromSession();
  }

  function isFavorite(productId: string): boolean {
    return getSession().isFavorite(productId);
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
