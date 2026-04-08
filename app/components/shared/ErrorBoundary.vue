<script setup lang="ts">
import { Button } from '~/components/ui/button';

const props = withDefaults(
  defineProps<{
    section?: string;
  }>(),
  { section: 'section' },
);

const { error, clearError } = useErrorBoundary({
  component: `ErrorBoundary:${props.section}`,
});
</script>

<template>
  <div
    v-if="error"
    role="alert"
    class="border-destructive/20 bg-destructive/5 rounded-md border p-4 text-center"
  >
    <p class="text-muted-foreground text-sm">
      {{ $t('errors.section_failed') }}
    </p>
    <Button variant="link" class="mt-2 h-auto p-0 text-xs" @click="clearError">
      {{ $t('errors.retry') }}
    </Button>
  </div>
  <slot v-else />
</template>
