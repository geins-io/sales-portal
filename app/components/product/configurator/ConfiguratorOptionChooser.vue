<script setup lang="ts">
import type { ConfigurationOption } from '#shared/types/configurator';
import { ChevronRight, Lock } from 'lucide-vue-next';
import { isReadOnly, optionBlockReason } from '~/utils/configurator-form';

/**
 * The one row a long single-choice group shows in place of its rows: what to
 * choose while nothing is, or the chosen row once something is. The whole row
 * opens the group's full list.
 *
 * It stays openable while a batch is in flight: opening a list sends nothing,
 * and the rows in it carry the form's lock.
 */
const {
  chosen,
  groupName,
  count,
  disabled = false,
} = defineProps<{
  chosen: ConfigurationOption | undefined;
  groupName: string;
  /** Every row of the group, for the line under the prompt. */
  count: number;
  /** The form's lock, which keeps a batch in flight out of the reason. */
  disabled?: boolean;
}>();

const emit = defineEmits<{ open: [] }>();

const { t } = useI18n();

const readOnly = computed(() => !!chosen && isReadOnly(chosen));

const block = computed(() =>
  chosen ? optionBlockReason(chosen, disabled) : undefined,
);

const reason = computed(() => {
  if (!block.value) return undefined;
  if (block.value.kind === 'message') return block.value.message.text;
  return block.value.kind === 'read_only'
    ? t('configurator.read_only')
    : t('configurator.unavailable');
});
</script>

<template>
  <button
    type="button"
    data-testid="configurator-group-chooser"
    :data-option-id="chosen?.id"
    :data-selected="!!chosen"
    class="hover:bg-accent/50 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
    :class="chosen ? 'border-selected/60 bg-selected/5' : ''"
    @click="emit('open')"
  >
    <span class="min-w-0 flex-1">
      <span class="flex items-center justify-between gap-2">
        <span
          class="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium"
        >
          {{
            chosen
              ? chosen.name
              : t('configurator.choose_in_group', { name: groupName })
          }}
          <Lock
            v-if="readOnly"
            data-testid="configurator-chooser-lock"
            class="text-muted-foreground size-3 shrink-0"
            :aria-label="t('configurator.read_only')"
          />
        </span>
        <ConfiguratorOptionPrice
          v-if="chosen"
          :option="chosen"
          class="shrink-0"
        />
      </span>
      <span class="text-muted-foreground block text-xs">
        {{
          chosen
            ? chosen.articleNumber
            : t('configurator.option_count', { count })
        }}
      </span>
      <span
        v-if="reason"
        data-testid="configurator-chooser-reason"
        class="block text-xs"
        :class="
          chosen?.available ? 'text-muted-foreground' : 'text-destructive'
        "
      >
        {{ reason }}
      </span>
    </span>
    <ChevronRight class="text-muted-foreground size-5 shrink-0" />
  </button>
</template>
