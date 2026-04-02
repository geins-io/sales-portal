import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', () => {
  const isLoading = ref(false);
  const sidebarOpen = ref(false);

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function setSidebarOpen(open: boolean) {
    sidebarOpen.value = open;
  }

  return {
    isLoading,
    sidebarOpen,
    setLoading,
    toggleSidebar,
    setSidebarOpen,
  };
});
