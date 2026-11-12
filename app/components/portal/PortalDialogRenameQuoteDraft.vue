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

const props = withDefaults(
  defineProps<{
    open: boolean;
    name?: string;
    pending?: boolean;
    /** Naming a new request rather than renaming a draft. */
    mode?: 'rename' | 'new';
    /** Why the last submit did not go through. */
    error?: string | null;
  }>(),
  { name: '', mode: 'rename', error: null },
);

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

const copy = computed(() =>
  props.mode === 'new'
    ? {
        title: t('portal.quotations.rename_dialog.new_title'),
        description: t('portal.quotations.rename_dialog.new_description'),
        submit: t('portal.quotations.rename_dialog.new_submit'),
      }
    : {
        title: t('portal.quotations.rename_dialog.title'),
        description: t('portal.quotations.rename_dialog.description'),
        submit: t('portal.quotations.rename_dialog.submit'),
      },
);

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
          <DialogTitle>{{ copy.title }}</DialogTitle>
          <DialogDescription>{{ copy.description }}</DialogDescription>
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

        <p
          v-if="error"
          role="alert"
          class="text-destructive text-sm"
          data-testid="rename-draft-failed"
        >
          {{ error }}
        </p>

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
            {{ copy.submit }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
