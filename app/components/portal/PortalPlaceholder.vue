<script setup lang="ts">
import { Construction } from 'lucide-vue-next';
const { t } = useI18n();
</script>

<template>
  <div
    data-testid="portal-placeholder"
    class="flex flex-col items-center justify-center py-16 text-center"
  >
    <div
      class="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full"
    >
      <Construction class="size-6" />
    </div>
    <h2 class="text-lg font-semibold">
      {{ t('portal.placeholder.title') }}
    </h2>
    <p class="text-muted-foreground mt-1 text-sm">
      {{ t('portal.placeholder.description') }}
    </p>
  </div>
</template>
