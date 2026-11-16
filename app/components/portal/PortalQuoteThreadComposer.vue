<script setup lang="ts">
/**
 * Write to the seller at the bottom of the quote log, or reply to one entry.
 * ⌘/Ctrl + Enter sends. A failed send keeps the text and the reply.
 */
import { CornerUpLeft, Send, X } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { internalFetch } from '~/utils/internal-fetch';
import { QUOTE_MESSAGE_MAX_LENGTH } from '#shared/constants/quote';

/** The entry a reply answers, as the field quotes it. */
export interface QuoteReplyTarget {
  id: string;
  name: string;
  text: string;
}

const props = defineProps<{ quoteId: string }>();
const replyTo = defineModel<QuoteReplyTarget | null>('replyTo', {
  default: null,
});

const emit = defineEmits<{ sent: []; failed: [] }>();

const { t } = useI18n();

const text = ref('');
const sending = ref(false);
const failed = ref(false);
const field = ref<HTMLTextAreaElement | null>(null);

const tooLong = computed(() => text.value.length > QUOTE_MESSAGE_MAX_LENGTH);
const canSend = computed(
  () => !!text.value.trim() && !tooLong.value && !sending.value,
);

function focus() {
  field.value?.focus();
}
defineExpose({ focus });

async function send() {
  if (!canSend.value) return;
  sending.value = true;
  failed.value = false;
  const answerRef = replyTo.value?.id;
  try {
    await internalFetch(
      `/api/quotes/${encodeURIComponent(props.quoteId)}/messages`,
      {
        method: 'POST',
        body: { message: text.value.trim(), ...(answerRef && { answerRef }) },
      },
    );
    text.value = '';
    if (replyTo.value) replyTo.value = null;
    emit('sent');
  } catch {
    failed.value = true;
    emit('failed');
  } finally {
    sending.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  send();
}
</script>

<template>
  <div
    class="border-border space-y-2 border-t px-6 py-4"
    data-testid="quote-thread-composer"
  >
    <div
      v-if="replyTo"
      class="bg-muted flex items-start gap-2 rounded-md px-3 py-2 text-xs"
      data-testid="quote-thread-replying"
    >
      <CornerUpLeft
        class="text-muted-foreground mt-0.5 size-3.5 shrink-0"
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1">
        <p class="text-muted-foreground">
          {{
            t('portal.quotations.thread.replying_to', { name: replyTo.name })
          }}
        </p>
        <p class="line-clamp-1" v-text="replyTo.text" />
      </div>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground"
        :aria-label="t('portal.quotations.thread.cancel_reply')"
        data-testid="quote-thread-cancel-reply"
        @click="replyTo = null"
      >
        <X class="size-3.5" />
      </button>
    </div>

    <textarea
      ref="field"
      v-model="text"
      rows="3"
      :placeholder="t('portal.quotations.thread.placeholder')"
      :aria-label="t('portal.quotations.thread.placeholder')"
      class="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
      data-testid="quote-thread-input"
      @keydown="onKeydown"
    />

    <div class="flex items-center justify-between gap-3">
      <p
        v-if="failed"
        role="alert"
        class="text-destructive text-sm"
        data-testid="quote-thread-send-error"
      >
        {{ t('portal.quotations.thread.send_failed') }}
      </p>
      <p
        v-else-if="tooLong"
        class="text-destructive text-xs tabular-nums"
        data-testid="quote-thread-too-long"
      >
        {{
          t('portal.quotations.thread.too_long', {
            count: text.length,
            max: QUOTE_MESSAGE_MAX_LENGTH,
          })
        }}
      </p>
      <p
        v-else
        class="text-muted-foreground text-xs"
        data-testid="quote-thread-hint"
      >
        {{ t('portal.quotations.thread.hint') }}
      </p>
      <Button
        size="sm"
        class="gap-1.5"
        :disabled="!canSend"
        data-testid="quote-thread-send"
        @click="send"
      >
        <Send class="size-3.5" />
        {{ t('portal.quotations.thread.send') }}
      </Button>
    </div>
  </div>
</template>
