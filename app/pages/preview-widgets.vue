<script setup lang="ts">
definePageMeta({ layout: false });

useHead({
  title: 'CMS Preview',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const route = useRoute();
const { localePath } = useLocaleMarket();
const { exitPreview } = useCmsPreview();
const { tenant } = useTenant();

const loginToken = route.query.loginToken as string | undefined;
const redirect = route.query.redirect as string | undefined;

const authError = ref<string | null>(null);
const isReady = ref(false);

// SSR-safe: validate token during server render and client navigation alike.
if (!loginToken) {
  await navigateTo(localePath('/'), { replace: true });
}

const { error: previewError } = await useAsyncData('preview-auth', () =>
  $fetch('/api/auth/preview', {
    method: 'POST',
    body: { loginToken },
  }),
);

if (previewError.value) {
  authError.value = 'Invalid or expired preview token';
} else {
  isReady.value = true;

  // If redirect flag is set, go to home after successful auth
  if (redirect === 'true') {
    await navigateTo(localePath('/'), { replace: true });
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <div class="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-lg">
      <!-- Error state -->
      <div v-if="authError" class="space-y-4 text-center">
        <div
          class="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100"
        >
          <svg
            class="size-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 class="text-lg font-semibold text-gray-900">Preview Failed</h1>
        <p class="text-sm text-gray-500">{{ authError }}</p>
        <a
          :href="localePath('/')"
          class="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Go to site
        </a>
      </div>

      <!-- Success state -->
      <div v-else-if="isReady" class="space-y-4 text-center">
        <div
          class="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100"
        >
          <svg
            class="size-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 class="text-lg font-semibold text-gray-900">Preview Mode Active</h1>
        <p class="text-sm text-gray-500">
          Connected to
          <span class="font-medium text-gray-700">{{
            tenant?.hostname ?? 'storefront'
          }}</span>
        </p>
        <p class="text-xs text-gray-400">
          Draft content will be shown. Cache is bypassed.
        </p>
        <div class="flex justify-center gap-3 pt-2">
          <a
            :href="localePath('/')"
            class="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
          >
            Browse site
          </a>
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            @click="exitPreview"
          >
            Exit preview
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-else class="space-y-4 text-center">
        <div
          class="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-100"
        >
          <svg
            class="size-6 animate-spin text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
            />
          </svg>
        </div>
        <p class="text-sm text-gray-500">Activating preview...</p>
      </div>
    </div>
  </div>
</template>
