<script setup lang="ts">
const { hasFeature } = useTenant();
</script>

<template>
  <footer class="border-t">
    <LayoutFooterTop v-if="hasFeature('newsletter')" />
    <div class="bg-footer-background text-footer-text">
      <LayoutFooterMain />
      <LayoutFooterBottom />
    </div>
  </footer>
</template>
