<script setup lang="ts">
/**
 * Confirm an answer to a quotation before it is sent — withdraw, decline,
 * accept. None of them can be undone. With `withMessage`, the buyer may add
 * a message to the seller, which Geins stores with the status change.
 */
import { QUOTE_MESSAGE_MAX_LENGTH } from '#shared/constants/quote';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';

defineProps<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Opting out (withdraw, decline) is shown as destructive. */
  destructive?: boolean;
  pending?: boolean;
  /** A field for a message to the seller, sent with the answer. */
  withMessage?: boolean;
  messagePlaceholder?: string;
}>();

const message = defineModel<string>('message', { default: '' });

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
}>();

const { t } = useI18n();
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent data-testid="quote-action-dialog" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <div v-if="withMessage" class="space-y-2">
        <Label for="quote-action-message">{{
          t('portal.quotations.answer_message')
        }}</Label>
        <textarea
          id="quote-action-message"
          v-model="message"
          :placeholder="messagePlaceholder"
          :maxlength="QUOTE_MESSAGE_MAX_LENGTH"
          :disabled="pending"
          rows="4"
          class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-20 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="quote-action-message"
        />
        <p
          class="text-muted-foreground text-right text-xs tabular-nums"
          data-testid="quote-action-message-count"
        >
          {{ message.length }} / {{ QUOTE_MESSAGE_MAX_LENGTH }}
        </p>
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          data-testid="quote-action-cancel"
          @click="emit('update:open', false)"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          :variant="destructive ? 'destructive' : 'default'"
          data-testid="quote-action-confirm"
          :disabled="pending"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
