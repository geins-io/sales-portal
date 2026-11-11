<script setup lang="ts">
import { QUOTE_NAME_MAX_LENGTH } from '#shared/constants/quote';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

const props = defineProps<{
  open: boolean;
  name: string;
  pending?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  submit: [name: string];
}>();

const { t } = useI18n();

const draftName = ref('');
const touched = ref(false);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    draftName.value = props.name;
    touched.value = false;
  },
  { immediate: true },
);

const trimmed = computed(() => draftName.value.trim());

function submit() {
  touched.value = true;
  if (!trimmed.value || props.pending) return;
  emit('submit', trimmed.value);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent data-testid="rename-draft-dialog" class="sm:max-w-md">
      <form class="grid gap-4" novalidate @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{
            t('portal.quotations.rename_dialog.title')
          }}</DialogTitle>
          <DialogDescription>
            {{ t('portal.quotations.rename_dialog.description') }}
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-2">
          <Label for="rename-draft-input">{{
            t('portal.quotations.rename_dialog.label')
          }}</Label>
          <Input
            id="rename-draft-input"
            v-model="draftName"
            data-testid="rename-draft-input"
            autocomplete="off"
            :maxlength="QUOTE_NAME_MAX_LENGTH"
            :placeholder="t('portal.quotations.rename_dialog.placeholder')"
            :aria-invalid="touched && !trimmed"
            aria-describedby="rename-draft-error"
          />
          <p
            v-if="touched && !trimmed"
            id="rename-draft-error"
            data-testid="rename-draft-error"
            class="text-destructive text-sm"
          >
            {{ t('portal.quotations.rename_dialog.required') }}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="rename-draft-cancel"
            @click="emit('update:open', false)"
          >
            {{ t('common.cancel') }}
          </Button>
          <Button
            type="submit"
            data-testid="rename-draft-submit"
            :disabled="pending"
          >
            {{ t('portal.quotations.rename_dialog.submit') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
