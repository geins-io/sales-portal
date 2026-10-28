<script setup lang="ts">
/**
 * Confirm an answer to a quotation before it is sent — withdraw, decline,
 * accept. None of them can be undone.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';

defineProps<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Opting out (withdraw, decline) is shown as destructive. */
  destructive?: boolean;
  pending?: boolean;
}>();

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
