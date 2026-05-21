<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { NuxtLink } from '#components';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

const { localePath } = useLocaleMarket();
const { logoUrl, rawLogoUrl, logoDarkUrl, logoSymbolUrl, brandName } =
  useTenant();

const effectiveSrc = computed(() => props.src ?? logoUrl.value);
const effectiveSrcDark = computed(() => props.srcDark ?? logoDarkUrl.value);
const effectiveSrcSymbol = computed(
  () => props.srcSymbol ?? logoSymbolUrl.value,
);
const effectiveAlt = computed(() => props.alt ?? brandName.value);

// Show the avatar+name fallback only when the tenant has not configured a logo
// (and the caller hasn't passed an explicit src override).
const showFallback = computed(() => !props.src && !rawLogoUrl.value);

const iconFallback = computed(() =>
  (brandName.value ?? '').trim().charAt(0).toUpperCase(),
);

const tag = computed(() => (props.linked ? NuxtLink : 'span'));
</script>

<template>
  <component
    :is="tag"
    :to="linked ? localePath('/') : undefined"
    data-slot="logo"
    :class="cn('inline-flex items-center', props.class)"
  >
    <template v-if="showFallback">
      <Avatar
        v-if="iconFallback"
        class="bg-accent text-accent-foreground mr-4 size-12 shrink-0"
      >
        <AvatarFallback
          class="bg-accent text-accent-foreground font-heading text-xl font-bold"
        >
          <span
            class="inline-block [text-box-edge:cap_alphabetic] [text-box-trim:trim-both]"
          >
            {{ iconFallback }}
          </span>
        </AvatarFallback>
      </Avatar>
      <h1 v-if="brandName" class="text-xl font-semibold tracking-wide">
        {{ brandName }}
      </h1>
    </template>

    <template v-else>
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
    </template>
  </component>
</template>
