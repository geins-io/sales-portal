<script setup lang="ts">
/**
 * The quote log: a button with the message count, and a sheet from the right
 * with the conversation and its events oldest first, and a field to write in.
 */
import { nextTick } from 'vue';
import {
  ArrowRight,
  CornerUpLeft,
  MessageSquare,
  MoreHorizontal,
} from 'lucide-vue-next';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import PortalQuoteThreadComposer, {
  type QuoteReplyTarget,
} from './PortalQuoteThreadComposer.vue';
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
import type {
  QuoteStatus,
  QuoteThread,
  QuoteThreadEntry,
} from '#shared/types/quote';

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

async function scrollToEnd() {
  await nextTick();
  if (list.value) list.value.scrollTop = list.value.scrollHeight;
}

async function openThread() {
  open.value = true;
  await refresh();
  await scrollToEnd();
}

const replyTo = ref<QuoteReplyTarget | null>(null);
const composer = ref<{ focus: () => void } | null>(null);
let focusComposer = false;

function startReply(entry: QuoteThreadEntry) {
  replyTo.value = {
    id: entry.id,
    name: authorOf(entry),
    text: entry.text ?? eventText(entry),
  };
  focusComposer = true;
}

/** The menu gives focus back to ⋯ as it closes; after "Svara" the field takes it. */
function onMenuCloseFocus(event: Event) {
  if (!focusComposer) return;
  focusComposer = false;
  event.preventDefault();
  composer.value?.focus();
}

// After a write the read must start anew: a read still on its way may have
// left before the write landed.
const rereadAfterWrite = () => refresh({ dedupe: 'cancel' });

async function onSent() {
  await rereadAfterWrite();
  await scrollToEnd();
}

/** A reply whose message is gone from the thread goes again as a plain one. */
async function onFailed() {
  await rereadAfterWrite();
  const id = replyTo.value?.id;
  if (id && !thread.value?.entries.some((e) => e.id === id)) {
    replyTo.value = null;
  }
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

/**
 * A status pill outlined so it reads on the entry's tint. A solid badge has
 * white text, which on a white pill takes the badge's colour instead.
 */
function outlined(status: QuoteStatus) {
  return [
    'bg-card border-current/30',
    getQuoteStatusVariant(status) === 'success-solid' && 'text-success',
  ];
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
            class="rounded-[0.375rem] border px-4 py-3"
            :class="
              entry.side === 'buyer'
                ? 'border-success/20 bg-success/8 ml-8 sm:ml-16'
                : 'border-info/20 bg-info/8 mr-8 sm:mr-16'
            "
          >
            <div
              v-if="entry.replyTo"
              class="bg-card/70 mb-3 rounded-[4px] px-3 py-2 text-xs"
              data-testid="quote-thread-reply"
            >
              <p class="text-foreground/70">
                {{ entry.replyTo.authorName }}
              </p>
              <p
                class="text-foreground/70 line-clamp-2 whitespace-pre-line"
                v-text="entry.replyTo.text || '—'"
              />
            </div>

            <header class="flex items-start gap-3">
              <span
                class="border-border bg-card flex size-8 shrink-0 items-center justify-center rounded-md border text-xs font-medium"
                aria-hidden="true"
              >
                {{ initials(authorOf(entry)) }}
              </span>
              <p class="min-w-0 flex-1 truncate text-sm font-medium">
                {{ authorOf(entry) }}
              </p>
              <div class="flex shrink-0 items-center gap-2">
                <span
                  v-if="hasChange(entry)"
                  class="hidden items-center gap-1 sm:flex"
                  data-testid="quote-thread-change"
                >
                  <Badge
                    :variant="getQuoteStatusVariant(entry.event!.from!)"
                    :class="outlined(entry.event!.from!)"
                  >
                    {{ t(getQuoteStatusLabelKey(entry.event!.from!)) }}
                  </Badge>
                  <ArrowRight
                    class="text-foreground/70 size-3"
                    aria-hidden="true"
                  />
                  <Badge
                    :variant="getQuoteStatusVariant(entry.event!.to!)"
                    :class="outlined(entry.event!.to!)"
                  >
                    {{ t(getQuoteStatusLabelKey(entry.event!.to!)) }}
                  </Badge>
                </span>
                <time
                  :datetime="entry.at"
                  class="text-foreground/70 text-xs whitespace-nowrap"
                >
                  {{ formatWhen(entry.at) }}
                </time>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="-mr-2"
                      :aria-label="t('portal.quotations.thread.more')"
                      data-testid="quote-thread-more"
                    >
                      <MoreHorizontal class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    @close-auto-focus="onMenuCloseFocus"
                  >
                    <DropdownMenuItem
                      data-testid="quote-thread-reply-action"
                      @select="startReply(entry)"
                    >
                      <CornerUpLeft class="size-4" />
                      {{ t('portal.quotations.thread.reply') }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <p
              v-if="entry.event"
              class="text-foreground/70 mt-2 pl-11 text-xs italic"
              data-testid="quote-thread-event"
            >
              {{ eventText(entry) }}
            </p>

            <p
              v-if="entry.text"
              class="mt-2 pl-11 text-sm wrap-break-word whitespace-pre-line"
              data-testid="quote-thread-text"
              v-text="entry.text"
            />
          </article>
        </template>
      </div>

      <PortalQuoteThreadComposer
        v-if="thread"
        ref="composer"
        v-model:reply-to="replyTo"
        :quote-id="quoteId"
        @sent="onSent"
        @failed="onFailed"
      />
    </SheetContent>
  </Sheet>
</template>
