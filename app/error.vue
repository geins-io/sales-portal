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

const handleError = () => {
  clearError({ redirect: '/' });
};

const handleBack = () => {
  // Try to go back in history, or go home if no history
  if (window.history.length > 1) {
    window.history.back();
  } else {
    clearError({ redirect: '/' });
  }
};
</script>

<template>
  <div
    class="bg-background flex min-h-screen flex-col items-center justify-center px-4"
  >
    <div class="mx-auto max-w-md text-center">
      <!-- Error Code -->
      <p class="text-primary text-7xl font-bold">
        {{ error.statusCode }}
      </p>

      <!-- Error Title -->
      <h1 class="text-foreground mt-4 text-2xl font-semibold">
        {{ errorTitle }}
      </h1>

      <!-- Error Description -->
      <p class="text-muted-foreground mt-2">
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
      <p class="text-muted-foreground mt-8 text-sm">
        If you believe this is an error, please
        <a href="mailto:support@example.com" class="text-primary underline">
          contact support </a
        >.
      </p>

      <!-- Debug Info (Development Only) -->
      <div
        v-if="error.stack && isDev"
        class="border-border bg-muted mt-8 rounded-lg border p-4 text-left"
      >
        <p class="text-foreground mb-2 text-sm font-medium">Debug Info:</p>
        <pre
          class="text-muted-foreground overflow-auto text-xs whitespace-pre-wrap"
          >{{ error.stack }}</pre
        >
      </div>
    </div>
  </div>
</template>
