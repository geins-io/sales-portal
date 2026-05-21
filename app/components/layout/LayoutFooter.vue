<script setup lang="ts">
const { hasFeature } = useTenant();
</script>

<template>
  <footer class="bg-footer-background text-footer-text border-t">
    <LayoutFooterTop v-if="hasFeature('newsletter')" />
    <LayoutFooterMain />
    <LayoutFooterBottom />
  </footer>
</template>
