<script setup lang="ts">
const { showNewsletter } = useNewsletterVisibility();
</script>

<template>
  <footer class="bg-footer-background text-footer-text border-t">
    <LayoutFooterTop v-if="showNewsletter" />
    <LayoutFooterMain />
    <LayoutFooterBottom />
  </footer>
</template>
