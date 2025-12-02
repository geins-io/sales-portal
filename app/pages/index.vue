<script setup lang="ts">
const { data: tenantConfig } = await useApi<TenantConfig>('/api/config');
console.log('tenantConfig', tenantConfig.value);
</script>
<template>
  <div>{start page content}</div>
</template>
