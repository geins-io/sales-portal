<script setup lang="ts">
import type { ConfigurationOption } from '#shared/types/configurator';
import { ChevronRight, Lock } from 'lucide-vue-next';
import {
  isOptionReadOnly,
  optionBlockReason,
  optionImage,
} from '~/utils/configurator-form';

/**
 * The one row a long single-choice group shows in place of its rows: what to
 * choose while nothing is, or the chosen row once something is. The whole row
 * opens the group's full list. A group the buyer may skip has "nothing chosen"
 * chosen rather than nothing, so it reads that, as the none row does: no image
 * box, no article number, no price.
 *
 * A group with nothing to choose says so in place of the prompt, and still
 * opens: the buyer sees what the earlier choices ruled out.
 *
 * It stays openable while a batch is in flight: opening a list sends nothing,
 * and the rows in it carry the form's lock.
 */
const {
  chosen,
  none = false,
  count,
  imageColumn,
  disabled = false,
  unavailable = false,
  nothingToChoose = false,
} = defineProps<{
  chosen: ConfigurationOption | undefined;
  /** The group offers "nothing chosen", which stands in when nothing is. */
  none?: boolean;
  /** Every row of the group, for the line under the prompt. */
  count: number;
  /** The group's: the chosen option's image or a placeholder, or no box. */
  imageColumn: boolean;
  /** The form's lock, which keeps a batch in flight out of the reason. */
  disabled?: boolean;
  /** The group is unavailable, so a chosen row is too. */
  unavailable?: boolean;
  /** Said in place of the prompt while nothing is chosen. */
  nothingToChoose?: boolean;
}>();

const emit = defineEmits<{ open: [] }>();

const { t } = useI18n();

const readOnly = computed(() => !!chosen && isOptionReadOnly(chosen));

const showsNothing = computed(() => !chosen && nothingToChoose);

const showsNone = computed(() => !chosen && !nothingToChoose && none);

const block = computed(() =>
  chosen ? optionBlockReason(chosen, disabled, unavailable) : undefined,
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
    :data-none="showsNone"
    class="hover:bg-accent/50 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
    :class="chosen ? 'border-selected/60 bg-selected/5' : ''"
    @click="emit('open')"
  >
    <ConfiguratorOptionImage
      v-if="imageColumn && !showsNone"
      :file-name="chosen ? optionImage(chosen) : undefined"
      :alt="chosen?.name ?? ''"
    />
    <span class="min-w-0 flex-1">
      <span
        class="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium"
      >
        {{
          chosen
            ? chosen.name
            : showsNothing
              ? t('configurator.nothing_to_choose')
              : showsNone
                ? t('configurator.none_option')
                : t('configurator.choose')
        }}
        <Lock
          v-if="readOnly"
          data-testid="configurator-chooser-lock"
          class="text-muted-foreground size-3 shrink-0"
          :aria-label="t('configurator.read_only')"
        />
      </span>
      <span
        v-if="!showsNone && !showsNothing"
        class="text-muted-foreground block text-xs"
      >
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
          chosen?.available && !unavailable
            ? 'text-muted-foreground'
            : 'text-destructive'
        "
      >
        {{ reason }}
      </span>
    </span>
    <!-- Centred at the right edge like the option rows, not on the name's
         line as the prototype has it. -->
    <ConfiguratorOptionPrice v-if="chosen" :option="chosen" class="shrink-0" />
    <ChevronRight class="text-muted-foreground size-5 shrink-0" />
  </button>
</template>
