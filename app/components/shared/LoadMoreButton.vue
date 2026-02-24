<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';

defineProps<{
  loading: boolean;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  'load-more': [];
}>();
</script>

<template>
  <div v-if="hasMore" class="flex justify-center py-8">
    <Button variant="outline" :disabled="loading" @click="emit('load-more')">
      <Loader2 v-if="loading" class="mr-2 size-4 animate-spin" />
      {{ loading ? 'Loading...' : 'Load more' }}
    </Button>
  </div>
</template>
