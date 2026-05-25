<script setup lang="ts">
import { PackageX } from 'lucide-vue-next';

const { t } = useI18n();
</script>

<template>
  <div
    data-testid="oos-block"
    class="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
  >
    <PackageX class="size-4 shrink-0" />
    <span>{{ t('product.out_of_stock') }}</span>
  </div>
</template>
