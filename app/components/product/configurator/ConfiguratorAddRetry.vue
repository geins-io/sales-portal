<script setup lang="ts">
import { AlertCircle, Loader2, ShoppingCart } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';

/**
 * The second try for a configuration that was committed but did not reach the
 * cart. The commit is not repeated: the committed record is what is sent again.
 */
const { message, canRetry, busy } = defineProps<{
  /** Why the add failed; none while the retry runs. */
  message: string | null;
  canRetry: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{ retry: [] }>();

const { t } = useI18n();
</script>

<template>
  <div class="space-y-3" data-testid="configurator-add-failed">
    <p
      v-if="message"
      class="text-destructive flex items-start gap-2 text-sm"
      data-testid="configurator-add-error"
    >
      <AlertCircle class="mt-0.5 size-4 shrink-0" />
      {{ message }}
    </p>
    <Button
      class="w-full"
      size="lg"
      variant="purchase"
      :disabled="!canRetry"
      data-testid="configurator-add-retry"
      @click="emit('retry')"
    >
      <Loader2 v-if="busy" class="size-4 animate-spin" />
      <ShoppingCart v-else class="size-4" />
      {{ t('configurator.add_retry') }}
    </Button>
  </div>
</template>
