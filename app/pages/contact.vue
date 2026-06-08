<script setup lang="ts">
// The contact page is authored in the CMS as the `contact-form` page and
// rendered by the catch-all route. This route only preserves the legacy
// /contact URL by redirecting to it.
const { localePath } = useLocaleMarket();
await navigateTo(localePath('/contact-form'), { redirectCode: 301, replace: true });
</script>
<template><div /></template>
