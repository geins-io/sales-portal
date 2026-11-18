<script setup lang="ts">
/**
 * An event in the quote log that came without a message ("Anna Berg
 * accepterade offerten"): a thin grey line with an icon, the status change and
 * the time. No box and no menu, so what people wrote stands out.
 */
import { ArrowRight } from 'lucide-vue-next';
import type { Component } from 'vue';
import { Badge } from '~/components/ui/badge';
import {
  getQuoteStatusLabelKey,
  getQuoteStatusVariant,
} from '~/utils/quote-status';
import { outlinedStatusClass } from '~/utils/quote-log';
import type { QuoteStatus } from '#shared/types/quote';

const props = defineProps<{
  icon: Component;
  /** Who did it; none for what just happened, such as expiry. */
  actor?: string;
  /** What happened, e.g. "accepterade offerten". */
  label: string;
  /** The version it happened on, when the quotation has several. */
  version?: string;
  from?: QuoteStatus;
  to?: QuoteStatus;
  /** An instant (ISO 8601), and the same instant for people. */
  datetime: string;
  when: string;
}>();

const { t } = useI18n();

const change = computed(() =>
  props.from && props.to && props.from !== props.to
    ? [props.from, props.to]
    : null,
);
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-1">
    <span
      class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
      aria-hidden="true"
      data-testid="quote-thread-event-icon"
    >
      <component :is="icon" class="size-4" />
    </span>
    <div class="min-w-0 flex-1">
      <p
        class="text-muted-foreground text-sm"
        data-testid="quote-thread-event-text"
      >
        <template v-if="actor">
          <span
            class="text-foreground font-medium"
            data-testid="quote-thread-event-actor"
            >{{ actor }}</span>{{ ' ' }}
        </template>
        <span data-testid="quote-thread-event">{{ label }}</span>
      </p>
      <p
        v-if="version"
        class="text-muted-foreground text-xs whitespace-nowrap"
        data-testid="quote-thread-version"
      >
        {{ version }}
      </p>
    </div>
    <span
      v-if="change"
      class="hidden shrink-0 items-center gap-1 sm:flex"
      data-testid="quote-thread-change"
    >
      <Badge
        :variant="getQuoteStatusVariant(change[0]!)"
        :class="outlinedStatusClass(change[0]!)"
      >
        {{ t(getQuoteStatusLabelKey(change[0]!)) }}
      </Badge>
      <ArrowRight class="text-muted-foreground size-3" aria-hidden="true" />
      <Badge
        :variant="getQuoteStatusVariant(change[1]!)"
        :class="outlinedStatusClass(change[1]!)"
      >
        {{ t(getQuoteStatusLabelKey(change[1]!)) }}
      </Badge>
    </span>
    <time
      :datetime="datetime"
      class="text-muted-foreground shrink-0 text-xs whitespace-nowrap"
    >
      {{ when }}
    </time>
  </div>
</template>
