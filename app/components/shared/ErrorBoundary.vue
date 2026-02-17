<script setup lang="ts">
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
    <button class="text-primary mt-2 text-xs underline" @click="clearError">
      {{ $t('errors.retry') }}
    </button>
  </div>
  <slot v-else />
</template>
