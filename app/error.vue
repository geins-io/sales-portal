<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{
  error: NuxtError;
}>();

const isDev = import.meta.dev;
const { t } = useI18n();
const { tenant } = useTenant();

const is404 = computed(() => props.error.statusCode === 404);
const is418 = computed(() => props.error.statusCode === 418);
const is500 = computed(
  () =>
    (props.error.statusCode ?? 0) >= 500 && (props.error.statusCode ?? 0) < 600,
);

const errorTitle = computed(() => {
  if (is404.value) return t('errors.page_not_found_title');
  if (is500.value) return t('errors.server_error_title');
  return props.error.statusMessage || t('errors.generic_title');
});

const errorDescription = computed(() => {
  if (is418.value) return t('errors.teapot_description');
  if (is404.value) return t('errors.page_not_found_description');
  if (is500.value) return t('errors.server_error_description');
  return props.error.message || t('errors.generic_description');
});

useHead({
  title: errorTitle,
});

const supportEmail = computed(() => tenant.value?.contact?.email ?? null);

// Build locale-aware home path from cookies (composables may not be available in error page)
const homePath = computed(() => {
  const marketCookie = useCookie('market').value || 'se';
  const localeCookie = useCookie('locale').value || 'sv';
  return `/${marketCookie}/${localeCookie}/`;
});

const handleError = () => {
  clearError({ redirect: homePath.value });
};

const handleBack = () => {
  if (import.meta.client && window.history.length > 1) {
    window.history.back();
  } else {
    clearError({ redirect: homePath.value });
  }
};
</script>

<template>
  <div
    class="error-page flex min-h-screen flex-col items-center justify-center px-4"
  >
    <div class="mx-auto max-w-md text-center">
      <!-- Error Code -->
      <p class="error-page__code text-7xl font-bold">
        {{ error.statusCode }}
      </p>

      <!-- Error Title -->
      <h1 class="error-page__title mt-4 text-2xl font-semibold">
        {{ errorTitle }}
      </h1>

      <!-- Error Description -->
      <p class="error-page__muted mt-2">
        {{ errorDescription }}
      </p>

      <!-- Action Buttons -->
      <div
        v-if="!is418"
        class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
      >
        <Button class="min-w-[140px]" @click="handleError">
          <Icon name="lucide:home" class="mr-2 size-4" />
          {{ t('errors.go_home') }}
        </Button>

        <Button variant="outline" class="min-w-[140px]" @click="handleBack">
          <Icon name="lucide:arrow-left" class="mr-2 size-4" />
          {{ t('errors.go_back') }}
        </Button>
      </div>

      <!-- Additional Help (only when we have a real support email) -->
      <p v-if="supportEmail" class="error-page__muted mt-8 text-sm">
        {{ t('errors.contact_support_prefix') }}
        <a :href="`mailto:${supportEmail}`" class="error-page__link underline">
          {{ t('errors.contact_support_link') }} </a
        >.
      </p>

      <!-- Debug Info (Development Only) -->
      <div
        v-if="error.stack && isDev"
        class="error-page__debug mt-8 rounded-lg border p-4 text-left"
      >
        <p class="mb-2 text-sm font-medium">Debug Info:</p>
        <pre
          class="error-page__muted overflow-auto text-xs whitespace-pre-wrap"
          >{{ error.stack }}</pre
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * Fallback styles for the error page. These use CSS custom properties from
 * the tenant theme when available, with hardcoded fallbacks for when the
 * error occurs before theme CSS is loaded. No inline styles needed.
 */
.error-page {
  background-color: var(--background, #ffffff);
  color: var(--foreground, #1a1a1a);
}

.error-page__code {
  color: var(--primary, #0d9488);
}

.error-page__title {
  color: var(--foreground, #1a1a1a);
}

.error-page__muted {
  color: var(--muted-foreground, #6b7280);
}

.error-page__link {
  color: var(--primary, #0d9488);
}

.error-page__debug {
  border-color: var(--border, #e5e7eb);
  background-color: var(--muted, #f3f4f6);
}
</style>
