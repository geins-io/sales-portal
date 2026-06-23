import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', () => {
  const isLoading = ref(false);
  const sidebarOpen = ref(false);
  // Mobile search overlay. Desktop has the always-visible inline SearchBar;
  // on mobile the header search icon toggles this dropdown overlay open/closed.
  const mobileSearchOpen = ref(false);

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function setSidebarOpen(open: boolean) {
    sidebarOpen.value = open;
  }

  function toggleMobileSearch() {
    mobileSearchOpen.value = !mobileSearchOpen.value;
  }

  function setMobileSearchOpen(open: boolean) {
    mobileSearchOpen.value = open;
  }

  return {
    isLoading,
    sidebarOpen,
    mobileSearchOpen,
    setLoading,
    toggleSidebar,
    setSidebarOpen,
    toggleMobileSearch,
    setMobileSearchOpen,
  };
});
