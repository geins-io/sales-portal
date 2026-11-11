<script setup lang="ts">
/**
 * Deleting a draft is final, so it is confirmed. Removing a draft's last line
 * deletes it too: Geins keeps no draft without lines, so that is asked here.
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
  name: string;
  pending?: boolean;
  /** Opened by removing the draft's last line. */
  lastLine?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
}>();

const { t } = useI18n();
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent data-testid="delete-draft-dialog" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{
          lastLine
            ? t('portal.quotations.delete_dialog.last_line_title')
            : t('portal.quotations.delete_dialog.title')
        }}</DialogTitle>
        <DialogDescription>
          {{
            lastLine
              ? t('portal.quotations.delete_dialog.last_line_description')
              : t('portal.quotations.delete_dialog.description', { name })
          }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ t('common.cancel') }}
        </Button>
        <Button
          variant="destructive"
          data-testid="delete-draft-confirm"
          :disabled="pending"
          @click="emit('confirm')"
        >
          {{ t('portal.quotations.delete_dialog.submit') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
