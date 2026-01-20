import { defineStore } from 'pinia';

interface AppState {
  isLoading: boolean;
  sidebarOpen: boolean;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    isLoading: false,
    sidebarOpen: false,
  }),

  actions: {
    setLoading(loading: boolean) {
      this.isLoading = loading;
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },

    setSidebarOpen(open: boolean) {
      this.sidebarOpen = open;
    },
  },
});
