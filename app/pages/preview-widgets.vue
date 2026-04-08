<script setup lang="ts">
import { Button } from '~/components/ui/button';

/**
 * CMS Preview entry page.
 *
 * Usage: /preview-widgets?loginToken=JWT&redirect=true
 *
 * This page redirects to /api/auth/preview-enter which sets cookies
 * directly on the browser response (not via internal SSR fetch).
 * The API endpoint then redirects to the storefront homepage.
 *
 * Without redirect param: shows a status page with "Browse site" button.
 */
definePageMeta({ layout: false });

useHead({
  title: 'CMS Preview',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const route = useRoute();
const { localePath } = useLocaleMarket();
const { isPreview, exitPreview } = useCmsPreview();
const { tenant } = useTenant();

const loginToken = route.query.loginToken as string | undefined;
const redirect = route.query.redirect as string | undefined;

// No token and not in preview mode → go home
if (!loginToken && !isPreview) {
  await navigateTo(localePath('/'), { replace: true });
}

// With redirect flag → send browser directly to the API endpoint that
// sets cookies and redirects. This ensures Set-Cookie headers reach the browser.
if (loginToken && redirect === 'true') {
  const target = `/api/auth/preview-enter?loginToken=${encodeURIComponent(loginToken)}&redirect=${encodeURIComponent(localePath('/'))}`;
  await navigateTo(target, { external: true });
}

// Without redirect → activate preview via API and show status page
const authError = ref<string | null>(null);
const isReady = ref(false);

if (loginToken && redirect !== 'true') {
  // Client-side: call the API directly (browser makes real HTTP request)
  if (import.meta.client) {
    try {
      await $fetch('/api/auth/preview', {
        method: 'POST',
        body: { loginToken },
      });
      isReady.value = true;
    } catch {
      authError.value = 'Invalid or expired preview token';
    }
  } else {
    // SSR: redirect to the GET endpoint which sets cookies properly.
    // Do NOT include loginToken in the redirect URL — cookies are already set
    // by preview-enter, so returning here without a token shows the status page.
    const target = `/api/auth/preview-enter?loginToken=${encodeURIComponent(loginToken)}&redirect=${encodeURIComponent('/preview-widgets')}`;
    await navigateTo(target, { external: true });
  }
} else if (!loginToken && isPreview) {
  // Returned from preview-enter with cookies set — show success state
  isReady.value = true;
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

      <!-- Success state (cookies set, preview active) -->
      <div v-else-if="isReady || isPreview" class="space-y-4 text-center">
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
          <Button variant="outline" @click="exitPreview"> Exit preview </Button>
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
