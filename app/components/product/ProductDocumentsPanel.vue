<script setup lang="ts">
/** The documents tab's body: the product's files, or a line saying it has none. */
import type { ProductDocument } from '~/utils/product-documents';

defineProps<{ documents: ProductDocument[] }>();
</script>

<template>
  <h3 class="font-heading mb-4 text-2xl font-bold">
    {{ $t('product.documents') }}
  </h3>
  <ProductDocumentList v-if="documents.length" :documents="documents" />
  <p v-else class="text-muted-foreground text-sm">
    {{ $t('product.no_documents') }}
  </p>
</template>
