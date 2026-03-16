<script setup lang="ts">
definePageMeta({ layout: false });

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const route = useRoute();
const loginToken = route.query.loginToken as string | undefined;
const redirect = route.query.redirect as string | undefined;

// SSR-safe: validate token during server render and client navigation alike.
// If no loginToken query param, redirect immediately (works on both SSR and client).
if (!loginToken) {
  await navigateTo('/', { replace: true });
}

const { error: previewError } = await useAsyncData('preview-auth', () =>
  $fetch('/api/auth/preview', {
    method: 'POST',
    body: { loginToken },
  }),
);

// If token validation failed, redirect to home
if (previewError.value) {
  await navigateTo('/', { replace: true });
}

// If redirect flag is set, go to home after successful auth
if (redirect === 'true') {
  await navigateTo('/', { replace: true });
}
</script>

<template>
  <div class="flex h-screen items-center justify-center">
    <p class="text-sm text-gray-500">Loading preview...</p>
  </div>
</template>
