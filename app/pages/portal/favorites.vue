<script setup lang="ts">
import { useFavoritesStore } from '~/stores/favorites';

definePageMeta({ middleware: ['auth', 'feature'], feature: 'wishlist' });

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const favoritesStore = useFavoritesStore();
</script>

<template>
  <PortalShell>
    <div data-testid="favorites-page">
      <h2 class="text-2xl font-bold">{{ t('portal.favorites.title') }}</h2>

      <!-- Empty state -->
      <div
        v-if="favoritesStore.count === 0"
        data-testid="favorites-empty"
        class="mt-8 flex flex-col items-center gap-4 py-12 text-center"
      >
        <Icon name="lucide:heart" class="text-muted-foreground size-12" />
        <p class="text-muted-foreground">
          {{ t('portal.favorites.empty') }}
        </p>
        <NuxtLink
          :to="localePath('/products')"
          class="text-primary hover:text-primary/80 font-medium"
        >
          {{ t('portal.favorites.browse_products') }}
        </NuxtLink>
      </div>

      <!-- Favorites list -->
      <div v-else>
        <div class="mt-4 flex justify-end">
          <button
            data-testid="favorites-clear-all"
            class="text-destructive hover:text-destructive/80 text-sm font-medium"
            @click="favoritesStore.clear()"
          >
            {{ t('portal.favorites.clear_all') }}
          </button>
        </div>

        <ul data-testid="favorites-list" class="mt-4 divide-y">
          <li
            v-for="alias in favoritesStore.items"
            :key="alias"
            data-testid="favorite-item"
            class="flex items-center justify-between py-3"
          >
            <NuxtLink
              :to="`/${alias}`"
              class="text-primary hover:text-primary/80 font-medium"
            >
              {{ alias }}
            </NuxtLink>
            <button
              data-testid="favorite-remove"
              class="text-muted-foreground hover:text-destructive text-sm"
              @click="favoritesStore.remove(alias)"
            >
              {{ t('portal.favorites.remove') }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </PortalShell>
</template>
