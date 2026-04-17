<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { t } = useI18n();

useHead({
  title: computed(() => t('portal.tabs.organisation')),
});
</script>

<template>
  <PortalShell>
    <!-- Organisation page — placeholder per Figma. -->
    <!-- Functionality will be added when Geins B2B APIs are available. -->
  </PortalShell>
</template>
