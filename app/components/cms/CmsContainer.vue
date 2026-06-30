<script setup lang="ts">
import type { CmsContentContainer, ContentType } from '#shared/types/cms';
import { cmsVisibilityClass } from '#shared/utils/cms-visibility';

const props = defineProps<{
  container: CmsContentContainer;
  // When true, the container renders without its own max-width and horizontal
  // padding so an outer wrapper controls the width. Used by the portal hero,
  // which is already wrapped to the page-content width and must align flush.
  flush?: boolean;
  // When true, a container whose content includes a rich-text widget renders as
  // a contained, bordered "sheet" (background + border + reading-width cap)
  // instead of full-bleed. Lets a page render most blocks edge-to-edge like the
  // start page while long-form copy stays readable in a frame. Set by the
  // catch-all CMS page for non-sidebar, non-form pages; see app/pages/[...slug].vue.
  frameRichText?: boolean;
}>();

const RICH_TEXT_WIDGET = 'Rich textPageWidget';

// A rich-text block only self-frames when the page opts in via `frameRichText`.
// Sidebar/menu and apply/contact pages frame the whole content area instead, so
// they never pass the flag and their rich-text blocks render plain inside that
// outer frame (no double border).
const isRichTextFramed = computed(
  () =>
    Boolean(props.frameRichText) &&
    (props.container.content ?? []).some(
      (w) => w.config?.type === RICH_TEXT_WIDGET,
    ),
);

// When framed, the white "sheet" spans the full content width (its own gutter
// comes from the section) and the copy inside is capped to a reading column,
// mirroring the apply/contact frame: wide card, narrow content. Empty otherwise
// so non-framed blocks render through the wrapper unchanged.
const cardClasses = computed(() =>
  isRichTextFramed.value
    ? 'border-border rounded-lg border bg-white p-6 md:p-8'
    : '',
);

const layoutClasses = computed(() => {
  switch (props.container.layout) {
    case 'half':
      return 'grid md:grid-cols-2 gap-6';
    case 'third':
      return 'grid md:grid-cols-3 gap-6';
    case 'quarter':
      return 'grid sm:grid-cols-2 lg:grid-cols-4 gap-6';
    case 'full':
    default:
      return 'grid grid-cols-1 gap-6';
  }
});

const designClasses = computed(() => {
  if (props.flush) return '';
  switch (props.container.design) {
    case 'contained':
      return 'mx-auto max-w-7xl px-4 lg:px-6';
    case 'narrow':
      return 'mx-auto max-w-3xl px-4';
    case 'full-width':
      return 'w-full';
    default:
      return 'mx-auto max-w-7xl px-4 lg:px-6';
  }
});

// Per-container "Display settings", derived server-side from the two
// displaySetting fetches (see getContentArea) and applied as viewport-based
// Tailwind so visibility tracks the breakpoint (resize-aware), not the UA.
const visibilityClass = computed(() =>
  cmsVisibilityClass(props.container.visibility),
);

const activeWidgets = computed<ContentType[]>(() => {
  if (!props.container.content) return [];
  return props.container.content
    .filter((w) => w.config?.active !== false)
    .sort((a, b) => (a.config?.sortOrder ?? 0) - (b.config?.sortOrder ?? 0));
});

// "Mobile behavior" container setting (responsiveMode). "collapse" asks the card
// widgets to turn their item grid into a horizontal swipe slider on mobile while
// the container itself keeps its normal grid; anything else (incl. "stack", the
// default) leaves widgets to render as before. Normalised so casing can't
// silently disable it. Forwarded to every widget; only the cards widgets act on
// it (see JsonWidget.vue) so non-card widgets render unchanged.
const isCollapse = computed(
  () => props.container.responsiveMode?.trim().toLowerCase() === 'collapse',
);
</script>

<template>
  <section
    v-if="activeWidgets.length"
    :class="[
      isRichTextFramed ? 'mx-auto max-w-7xl px-4 lg:px-6' : designClasses,
      visibilityClass,
      (isRichTextFramed || container.design !== 'full-width') && 'py-4',
    ]"
  >
    <div :class="cardClasses">
      <div :class="[layoutClasses, isRichTextFramed && 'max-w-2xl']">
        <CmsWidget
          v-for="(widget, index) in activeWidgets"
          :key="`${container.id}-${index}`"
          :widget="widget"
          :layout="container.layout"
          :collapse="isCollapse"
        />
      </div>
    </div>
  </section>
</template>
