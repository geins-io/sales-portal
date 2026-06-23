<script setup lang="ts">
import { useEventListener, useScrollLock } from '@vueuse/core';
import { useAppStore } from '~/stores/app';

// Mobile-only search overlay. It reuses the same SearchBar (and its
// SearchAutocomplete hit list + query logic) the desktop header renders inline,
// so there is ONE responsive search experience: the mobile header icon toggles
// this dropdown open instead of navigating to a separate page.
const appStore = useAppStore();
const route = useRoute();

function close() {
  appStore.setMobileSearchOpen(false);
}

// Close when the route changes. Submitting a search or picking a result
// navigates away, mirroring how the mobile nav drawer dismisses itself.
watch(() => route.fullPath, close);

// Escape closes the whole overlay, not just the inner autocomplete dropdown.
// The target is resolved lazily and only on the client so SSR never touches
// `document`.
useEventListener(
  () => (import.meta.client ? document : null),
  'keydown',
  (e: KeyboardEvent) => {
    if (e.key === 'Escape' && appStore.mobileSearchOpen) close();
  },
);

// Lock page scroll while open so the darkened content behind stays inert; the
// autocomplete list keeps its own inner scroll.
const isLocked = useScrollLock(import.meta.client ? document.body : null);
watch(
  () => appStore.mobileSearchOpen,
  (open) => {
    isLocked.value = open;
  },
);
</script>

<template>
  <div class="lg:hidden">
    <!-- Dark backdrop over the page content. Teleported to <body> so it sits
         beneath the sticky header (z-50) while covering everything below it. -->
    <Teleport to="body">
      <div
        v-if="appStore.mobileSearchOpen"
        data-testid="mobile-search-backdrop"
        class="fixed inset-0 z-40 bg-black/50"
        @click="close"
      />
    </Teleport>

    <!-- White search area: a dropdown anchored to the bottom of the header. -->
    <div
      v-if="appStore.mobileSearchOpen"
      data-testid="mobile-search-panel"
      class="absolute top-full right-0 left-0 z-50 border-b bg-white shadow-lg"
      style="padding: 10px 20px"
    >
      <SearchBar autofocus />
    </div>
  </div>
</template>
