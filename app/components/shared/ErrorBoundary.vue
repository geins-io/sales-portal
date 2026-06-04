<script setup lang="ts">
import { Button } from '~/components/ui/button';

const props = withDefaults(
  defineProps<{
    section?: string;
    /**
     * When true, render nothing on error instead of the default message. Use
     * for per-widget boundaries that should degrade silently so one failing
     * widget cannot blank the whole page. A `fallback` slot still takes
     * precedence when provided.
     */
    silent?: boolean;
  }>(),
  { section: 'section', silent: false },
);

const { error, clearError } = useErrorBoundary({
  component: `ErrorBoundary:${props.section}`,
});
</script>

<template>
  <!--
    On error: a provided `fallback` slot wins (custom fallback, e.g. a frontpage
    placeholder). Otherwise, `silent` renders nothing so a per-widget boundary
    degrades quietly; without either, show the default section-failed message
    with a retry. `clearError` is exposed so a custom fallback can offer retry.
  -->
  <template v-if="error">
    <slot v-if="$slots.fallback" name="fallback" :clear-error="clearError" />
    <div
      v-else-if="!silent"
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
  </template>
  <slot v-else />
</template>
