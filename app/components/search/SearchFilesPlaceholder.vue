<script setup lang="ts">
import { FileText as FileTextIcon } from 'lucide-vue-next';
</script>

<template>
  <section data-testid="search-files-placeholder">
    <h2 class="mb-4 text-lg font-semibold">
      {{ $t('search.files_title') }}
    </h2>
    <EmptyState
      :icon="FileTextIcon"
      :title="$t('search.files_coming_soon')"
      :description="$t('search.files_coming_soon_description')"
    />
  </section>
</template>
