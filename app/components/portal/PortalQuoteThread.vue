<script setup lang="ts">
/**
 * The conversation on a quotation and its events, read only: a button with
 * the message count, and a sheet from the right with the thread oldest first.
 */
import { nextTick } from 'vue';
import { ArrowRight, MessageSquare } from 'lucide-vue-next';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import {
  getQuoteStatusLabelKey,
  getQuoteStatusVariant,
} from '~/utils/quote-status';
import type { QuoteThread, QuoteThreadEntry } from '#shared/types/quote';

const props = defineProps<{
  quoteId: string;
  /** Under the title, e.g. "2611-2-0024-00 · Verktyg". */
  subtitle: string;
}>();

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { timezone } = useTenant();

// Read after the page, so the quotation never waits for its thread.
const { data, error, refresh } = useFetch<{ thread: QuoteThread }>(
  `/api/quotes/${encodeURIComponent(props.quoteId)}/messages`,
  { lazy: true, server: false, dedupe: 'defer' },
);

const thread = computed(() => (error.value ? null : data.value?.thread));
const count = computed(() => thread.value?.messageCount ?? 0);

const open = ref(false);
const list = ref<HTMLElement | null>(null);

async function openThread() {
  open.value = true;
  await refresh();
  await nextTick();
  if (list.value) list.value.scrollTop = list.value.scrollHeight;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase(formatLocale.value))
    .join('');
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(formatLocale.value, {
    ...(timezone.value ? { timeZone: timezone.value } : {}),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** What happened, as a phrase after the author's name. */
function eventText(entry: QuoteThreadEntry) {
  return t(`portal.quotations.thread.event.${entry.event!.type}`);
}

/** Geins may send no name; the side still says who. */
function authorOf(entry: QuoteThreadEntry) {
  return entry.authorName || t(`portal.quotations.thread.author.${entry.side}`);
}

const hasChange = (entry: QuoteThreadEntry) =>
  !!entry.event?.from &&
  !!entry.event?.to &&
  entry.event.from !== entry.event.to;
</script>

<template>
  <Button
    variant="outline"
    size="sm"
    class="gap-1.5 shadow-none"
    data-testid="quote-thread-open"
    @click="openThread"
  >
    <MessageSquare class="size-4" />
    {{ t('portal.quotations.thread.open') }}
    <Badge
      v-if="count"
      variant="neutral"
      class="px-1.5 tabular-nums"
      data-testid="quote-thread-count"
    >
      {{ count }}
    </Badge>
  </Button>

  <Sheet :open="open" @update:open="open = $event">
    <SheetContent
      side="right"
      data-testid="quote-thread"
      class="flex h-dvh w-full flex-col gap-0 p-0 sm:max-w-2xl"
    >
      <SheetHeader class="border-border border-b px-6 py-5">
        <SheetTitle class="text-2xl font-semibold tracking-tight">
          {{ t('portal.quotations.thread.title') }}
        </SheetTitle>
        <SheetDescription>{{ subtitle }}</SheetDescription>
      </SheetHeader>

      <div
        ref="list"
        class="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5"
        aria-live="polite"
      >
        <p
          v-if="error"
          role="alert"
          class="text-destructive text-sm"
          data-testid="quote-thread-error"
        >
          {{ t('portal.quotations.thread.load_failed') }}
        </p>
        <p
          v-else-if="thread && !thread.entries.length"
          class="text-muted-foreground py-10 text-center text-sm"
          data-testid="quote-thread-empty"
        >
          {{ t('portal.quotations.thread.empty') }}
        </p>

        <template v-if="thread">
          <article
            v-for="entry in thread.entries"
            :key="entry.id"
            data-testid="quote-thread-entry"
            :data-side="entry.side"
            class="border-border bg-card rounded-lg border px-4 py-3"
            :class="entry.side === 'buyer' ? 'ml-8 sm:ml-16' : 'mr-8 sm:mr-16'"
          >
            <div
              v-if="entry.replyTo"
              class="bg-muted mb-3 rounded-md px-3 py-2 text-xs"
              data-testid="quote-thread-reply"
            >
              <p class="text-muted-foreground/80">
                {{ entry.replyTo.authorName }}
              </p>
              <p
                class="text-muted-foreground line-clamp-2 whitespace-pre-line"
                v-text="entry.replyTo.text || '—'"
              />
            </div>

            <header class="flex items-start gap-3">
              <span
                class="border-border flex size-8 shrink-0 items-center justify-center rounded-md border text-xs font-medium"
                aria-hidden="true"
              >
                {{ initials(authorOf(entry)) }}
              </span>
              <p class="min-w-0 flex-1 text-sm">
                <span class="font-medium">{{ authorOf(entry) }}</span>
                <span
                  v-if="entry.event"
                  class="text-muted-foreground ml-1.5 text-xs italic"
                  data-testid="quote-thread-event"
                  >{{ eventText(entry) }}</span
                >
              </p>
              <div class="flex shrink-0 items-center gap-2">
                <span
                  v-if="hasChange(entry)"
                  class="hidden items-center gap-1 sm:flex"
                  data-testid="quote-thread-change"
                >
                  <Badge :variant="getQuoteStatusVariant(entry.event!.from!)">
                    {{ t(getQuoteStatusLabelKey(entry.event!.from!)) }}
                  </Badge>
                  <ArrowRight class="text-muted-foreground size-3" />
                  <Badge :variant="getQuoteStatusVariant(entry.event!.to!)">
                    {{ t(getQuoteStatusLabelKey(entry.event!.to!)) }}
                  </Badge>
                </span>
                <time
                  :datetime="entry.at"
                  class="text-muted-foreground text-xs whitespace-nowrap"
                >
                  {{ formatWhen(entry.at) }}
                </time>
              </div>
            </header>

            <p
              v-if="entry.text"
              class="mt-2 pl-11 text-sm wrap-break-word whitespace-pre-line"
              data-testid="quote-thread-text"
              v-text="entry.text"
            />
          </article>
        </template>
      </div>
    </SheetContent>
  </Sheet>
</template>
