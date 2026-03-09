import { defineStore } from 'pinia';
import { FavoritesSession } from '@geins/crm';
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

  let session: FavoritesSession | null = null;

  function getSession(): FavoritesSession {
    if (!session) {
      session = new FavoritesSession({ storage: new LocalStorageAdapter() });
    }
    return session;
  }

  function syncFromSession() {
    const s = getSession();
    items.value = s.getAll();
  }

  function initialize() {
    if (import.meta.server) return;
    syncFromSession();
  }

  function toggle(productId: string): boolean {
    const result = getSession().toggle(productId);
    syncFromSession();
    return result;
  }

  function add(productId: string) {
    getSession().add(productId);
    syncFromSession();
  }

  function remove(productId: string) {
    getSession().remove(productId);
    syncFromSession();
  }

  function clear() {
    getSession().clear();
    syncFromSession();
  }

  function isFavorite(productId: string): boolean {
    return getSession().has(productId);
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
