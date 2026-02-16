<script setup lang="ts">
definePageMeta({ layout: false });

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const route = useRoute();
const loginToken = route.query.loginToken as string | undefined;
const redirect = route.query.redirect as string | undefined;

onMounted(async () => {
  if (!loginToken) {
    await navigateTo('/', { replace: true });
    return;
  }

  try {
    await $fetch('/api/auth/preview', {
      method: 'POST',
      body: { loginToken },
    });

    if (redirect === 'true') {
      await navigateTo('/', { replace: true });
    }
  } catch {
    await navigateTo('/', { replace: true });
  }
});
</script>

<template>
  <div class="flex h-screen items-center justify-center">
    <p class="text-sm text-gray-500">Loading preview...</p>
  </div>
</template>
