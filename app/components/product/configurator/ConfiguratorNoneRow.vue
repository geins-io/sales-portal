<script setup lang="ts">
import { NONE_ROW_VALUE } from '~/utils/configurator-form';
import { RadioGroupItem } from '~/components/ui/radio-group';

/**
 * "Nothing chosen", first in an optional single-choice group, as the
 * prototype's option layouts. It is the portal's row, not the provider's: the
 * document carries no such option, and choosing it deselects the one that is
 * chosen.
 *
 * Its `RadioGroupItem` belongs to the group's `RadioGroup`, which emits for it.
 * No image box, even where the other rows carry one, no article number and no
 * price.
 */
const { selected, disabled = false } = defineProps<{
  selected: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ pick: [] }>();

const { t } = useI18n();

function onRow() {
  if (disabled) return;
  emit('pick');
}
</script>

<template>
  <div
    data-testid="configurator-option-none"
    :data-selected="selected"
    class="rounded-lg border p-3 transition-colors"
    :class="[
      selected ? 'border-selected/60 bg-selected/5' : '',
      disabled ? 'opacity-50' : 'hover:bg-accent/50 cursor-pointer',
    ]"
    @click="onRow"
  >
    <div class="flex items-center gap-3">
      <RadioGroupItem
        :value="NONE_ROW_VALUE"
        :disabled="disabled"
        class="data-[state=checked]:border-selected [&_svg]:fill-selected"
        @click.stop
      />
      <p class="min-w-0 flex-1 text-sm font-medium">
        {{ t('configurator.none_option') }}
      </p>
    </div>
  </div>
</template>
