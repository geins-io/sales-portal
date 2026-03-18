<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{
  error: NuxtError;
}>();

const isDev = import.meta.dev;

const is404 = computed(() => props.error.statusCode === 404);
const is418 = computed(() => props.error.statusCode === 418);
const is500 = computed(
  () =>
    (props.error.statusCode ?? 0) >= 500 && (props.error.statusCode ?? 0) < 600,
);

const errorTitle = computed(() => {
  if (is404.value) return 'Page Not Found';
  if (is500.value) return 'Something Went Wrong';
  return props.error.statusMessage || 'An Error Occurred';
});

const errorDescription = computed(() => {
  if (is418.value) {
    return "I'm a teapot";
  }
  if (is404.value) {
    return "Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.";
  }
  if (is500.value) {
    return "We're experiencing some technical difficulties. Please try again later.";
  }
  return props.error.message || 'An unexpected error occurred.';
});

// Build locale-aware home path from cookies (composables may not be available in error page)
const homePath = computed(() => {
  const marketCookie = useCookie('market').value || 'se';
  const localeCookie = useCookie('locale').value || 'en';
  return `/${marketCookie}/${localeCookie}/`;
});

const handleError = () => {
  clearError({ redirect: homePath.value });
};

const handleBack = () => {
  // Try to go back in history, or go home if no history
  if (window.history.length > 1) {
    window.history.back();
  } else {
    clearError({ redirect: homePath.value });
  }
};
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center px-4"
    :style="{
      backgroundColor: 'var(--background, #ffffff)',
      color: 'var(--foreground, #1a1a1a)',
    }"
  >
    <div class="mx-auto max-w-md text-center">
      <!-- Error Code -->
      <p
        class="text-7xl font-bold"
        :style="{ color: 'var(--primary, #0d9488)' }"
      >
        {{ error.statusCode }}
      </p>

      <!-- Error Title -->
      <h1 class="mt-4 text-2xl font-semibold">
        {{ errorTitle }}
      </h1>

      <!-- Error Description -->
      <p class="mt-2" :style="{ color: 'var(--muted-foreground, #6b7280)' }">
        {{ errorDescription }}
      </p>

      <!-- Action Buttons -->
      <div
        v-if="!is418"
        class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
      >
        <Button class="min-w-[140px]" @click="handleError">
          <Icon name="lucide:home" class="mr-2 size-4" />
          Go Home
        </Button>

        <Button variant="outline" class="min-w-[140px]" @click="handleBack">
          <Icon name="lucide:arrow-left" class="mr-2 size-4" />
          Go Back
        </Button>
      </div>

      <!-- Additional Help -->
      <p
        class="mt-8 text-sm"
        :style="{ color: 'var(--muted-foreground, #6b7280)' }"
      >
        If you believe this is an error, please
        <a
          href="mailto:support@example.com"
          class="underline"
          :style="{ color: 'var(--primary, #0d9488)' }"
        >
          contact support </a
        >.
      </p>

      <!-- Debug Info (Development Only) -->
      <div
        v-if="error.stack && isDev"
        class="mt-8 rounded-lg border p-4 text-left"
        :style="{
          borderColor: 'var(--border, #e5e7eb)',
          backgroundColor: 'var(--muted, #f3f4f6)',
        }"
      >
        <p class="mb-2 text-sm font-medium">Debug Info:</p>
        <pre
          class="overflow-auto text-xs whitespace-pre-wrap"
          :style="{ color: 'var(--muted-foreground, #6b7280)' }"
          >{{ error.stack }}</pre
        >
      </div>
    </div>
  </div>
</template>
