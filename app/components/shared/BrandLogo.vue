<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<{
    src?: string;
    srcDark?: string;
    srcSymbol?: string;
    alt?: string;
    height?: string;
    linked?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  {
    height: 'h-8',
    linked: true,
  },
);

const { logoUrl, logoDarkUrl, logoSymbolUrl, brandName } = useTenant();

const effectiveSrc = computed(() => props.src ?? logoUrl.value);
const effectiveSrcDark = computed(() => props.srcDark ?? logoDarkUrl.value);
const effectiveSrcSymbol = computed(
  () => props.srcSymbol ?? logoSymbolUrl.value,
);
const effectiveAlt = computed(() => props.alt ?? brandName.value);

const tag = computed(() =>
  props.linked ? resolveComponent('NuxtLink') : 'span',
);
</script>

<template>
  <component
    :is="tag"
    :to="linked ? '/' : undefined"
    data-slot="logo"
    :class="cn('inline-flex items-center', props.class)"
  >
    <!-- Symbol logo (small screens, when available) -->
    <NuxtImg
      v-if="effectiveSrcSymbol"
      :src="effectiveSrcSymbol"
      :alt="effectiveAlt"
      :class="cn(height, 'block w-auto md:hidden')"
    />

    <!-- Full logo (light mode, or only logo) -->
    <NuxtImg
      :src="effectiveSrc"
      :alt="effectiveAlt"
      :class="
        cn(
          height,
          'w-auto',
          effectiveSrcSymbol ? 'hidden md:block' : '',
          effectiveSrcDark ? 'dark:hidden' : '',
        )
      "
    />

    <!-- Dark mode logo -->
    <NuxtImg
      v-if="effectiveSrcDark"
      :src="effectiveSrcDark"
      :alt="effectiveAlt"
      :class="
        cn(
          height,
          'hidden w-auto dark:block',
          effectiveSrcSymbol ? 'md:dark:block' : '',
        )
      "
    />
  </component>
</template>
