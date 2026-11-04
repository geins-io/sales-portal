<script setup lang="ts">
import { Info } from 'lucide-vue-next';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';

/** "≈ Estimated" on a request's summary, with what it means behind a click. */
const { t } = useI18n();
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        type="button"
        data-testid="quote-estimate-badge"
        class="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-1 inline-flex shrink-0 items-center gap-1 rounded py-0.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
      >
        ≈ {{ t('portal.quotations.request.estimate_badge') }}
        <Info class="size-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-64 text-sm"
      data-testid="quote-estimate-note"
    >
      {{ t('portal.quotations.request.estimate_note') }}
    </PopoverContent>
  </Popover>
</template>
