<script setup lang="ts">
import { PackageX } from 'lucide-vue-next';

const { t } = useI18n();
</script>

<template>
  <div
    data-testid="oos-block"
    class="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
  >
    <PackageX class="size-4 shrink-0" />
    <span>{{ t('product.out_of_stock') }}</span>
  </div>
</template>
