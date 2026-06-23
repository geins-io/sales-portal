import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore } from '../../app/stores/app';

describe('app store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('defaults the mobile search overlay to closed', () => {
    const store = useAppStore();
    expect(store.mobileSearchOpen).toBe(false);
  });

  it('toggleMobileSearch flips the overlay open and closed', () => {
    const store = useAppStore();
    store.toggleMobileSearch();
    expect(store.mobileSearchOpen).toBe(true);
    store.toggleMobileSearch();
    expect(store.mobileSearchOpen).toBe(false);
  });

  it('setMobileSearchOpen sets the overlay state explicitly', () => {
    const store = useAppStore();
    store.setMobileSearchOpen(true);
    expect(store.mobileSearchOpen).toBe(true);
    store.setMobileSearchOpen(false);
    expect(store.mobileSearchOpen).toBe(false);
  });

  it('keeps the sidebar and mobile search states independent', () => {
    const store = useAppStore();
    store.toggleMobileSearch();
    expect(store.mobileSearchOpen).toBe(true);
    expect(store.sidebarOpen).toBe(false);
  });
});
