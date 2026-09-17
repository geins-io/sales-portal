<script setup lang="ts">
/** The description tab's body, shared by every product page's tab row. */
defineProps<{ text2?: string; text3?: string }>();
</script>

<template>
  <h3 class="font-heading mb-4 text-2xl font-bold">
    {{ $t('product.details') }}
  </h3>
  <!-- eslint-disable vue/no-v-html -->
  <div class="max-w-3xl space-y-6">
    <div v-if="text2" class="prose max-w-none" v-html="text2" />
    <div v-if="text3" class="prose max-w-none" v-html="text3" />
  </div>
  <!-- eslint-enable vue/no-v-html -->
</template>
