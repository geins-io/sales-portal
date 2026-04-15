<script setup lang="ts">
withDefaults(
  defineProps<{
    fileName?: string | null;
    alt?: string;
    size?: string;
    radius?: string;
    iconSize?: string;
  }>(),
  {
    fileName: '',
    alt: '',
    size: 'size-10',
    radius: 'rounded',
    iconSize: 'size-4',
  },
);
</script>

<template>
  <div :class="['shrink-0 overflow-hidden', size, radius]">
    <GeinsImage
      v-if="fileName"
      :file-name="fileName"
      type="product"
      :alt="alt ?? ''"
      aspect-ratio="1"
      sizes="48px"
    />
    <div v-else class="bg-muted flex size-full items-center justify-center">
      <Icon
        name="lucide:image-off"
        :class="['text-muted-foreground', iconSize]"
      />
    </div>
  </div>
</template>
