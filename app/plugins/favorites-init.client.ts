import { useFavoritesStore } from '~/stores/favorites';

/**
 * Favorites Init Plugin (client-only)
 *
 * Hydrates the favorites store from the SDK ListsSession (localStorage)
 * after Pinia hydration has restored its SSR payload.
 *
 * Why this lives in a plugin and not the store factory: in Nuxt + Pinia
 * setup-style stores, the SSR-serialised state is restored on the client
 * AFTER the store factory runs. Any localStorage read inside the factory
 * gets clobbered by the empty SSR payload. A plugin runs after Pinia is
 * fully hydrated, so reads stick.
 *
 * See `docs/patterns/lists.md` and `docs/conventions/ssr.md`
 * (client-side storage stores).
 */
export default defineNuxtPlugin(() => {
  useFavoritesStore().initialize();
});
