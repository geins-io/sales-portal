import { defineStore } from 'pinia';

interface AppState {
  isLoading: boolean;
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    isLoading: false,
    sidebarOpen: false,
    theme: 'system',
  }),

  getters: {
    isDarkMode(): boolean {
      if (this.theme === 'system') {
        // Check system preference
        if (import.meta.client) {
          return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
      }
      return this.theme === 'dark';
    },
  },

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

    setTheme(theme: 'light' | 'dark' | 'system') {
      this.theme = theme;
    },

    toggleTheme() {
      const themes: Array<'light' | 'dark' | 'system'> = [
        'light',
        'dark',
        'system',
      ];
      const currentIndex = themes.indexOf(this.theme);
      this.theme = themes[(currentIndex + 1) % themes.length] ?? 'system';
    },
  },
});
