<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationOption,
} from '#shared/types/configurator';
import { Lock } from 'lucide-vue-next';
import {
  isReadOnly,
  messagesBesides,
  optionBlockReason,
  optionImage,
} from '~/utils/configurator-form';
import { Checkbox } from '~/components/ui/checkbox';
import { RadioGroupItem } from '~/components/ui/radio-group';

/**
 * One `ConfigurationOption`: the choice, named by the option itself, the
 * catalogue product's image, or a placeholder, when its group has an image
 * column, and whatever the provider said about it.
 *
 * A single-choice row renders a `RadioGroupItem` and does not emit — the
 * `RadioGroup` in the enclosing group owns the selection and emits for it. A
 * multi-choice row owns its own checkbox and emits. The quantity stepper emits
 * either way, because a quantity belongs to the row and not to the group.
 *
 * A click anywhere else on the row does what the control does: the whole row
 * is the target, which is what makes a list of them comfortable to use. The
 * controls stop that click so one press is one change, and they stay the
 * focusable elements, so the keyboard path is unchanged.
 */
const {
  option,
  single,
  quantityEditable = false,
  imageColumn,
  disabled = false,
  unavailable = false,
} = defineProps<{
  option: ConfigurationOption;
  single: boolean;
  quantityEditable?: boolean;
  /** The group's: every row has an image box, or none has. */
  imageColumn: boolean;
  /** The parent locks every control while a change batch is in flight. */
  disabled?: boolean;
  /** The group is unavailable, so the row is too, whatever it says itself. */
  unavailable?: boolean;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const { t } = useI18n();

const readOnly = computed(() => isReadOnly(option));

const available = computed(() => option.available && !unavailable);

const blocked = computed(() => disabled || readOnly.value || !available.value);

const block = computed(() => optionBlockReason(option, disabled, unavailable));
const promoted = computed(() =>
  block.value?.kind === 'message' ? block.value.message : undefined,
);

/** Why the row cannot be used. */
const reason = computed(() => {
  if (!block.value) return undefined;
  if (block.value.kind === 'message') return block.value.message.text;
  return block.value.kind === 'read_only'
    ? t('configurator.read_only')
    : t('configurator.unavailable');
});

/** The reason is shown on the row, so the message it came from is not. */
const messages = computed(() =>
  messagesBesides(option.messages, promoted.value),
);

const image = computed(() => optionImage(option));

function change(selected: boolean, quantity: number): ConfigurationChange {
  return {
    type: 'option',
    optionId: option.id,
    instanceId: option.instanceId,
    selected,
    quantity,
    lock: 'none',
  };
}

function onToggle(checked: boolean | 'indeterminate') {
  emit('change', change(checked === true, option.quantity));
}

function onQuantity(quantity: number) {
  emit('change', change(true, quantity));
}

/**
 * A row of a single-choice group sends the same change its `RadioGroup` would
 * have sent — the group forwards it either way, and only one of the two paths
 * can fire for one click.
 */
function onRow() {
  if (blocked.value) return;
  emit('change', change(single ? true : !option.selected, option.quantity));
}
</script>

<template>
  <div
    data-testid="configurator-option"
    :data-option-id="option.id"
    :data-selected="option.selected"
    class="rounded-lg border p-3 transition-colors"
    :class="[
      option.selected ? 'border-selected/60 bg-selected/5' : '',
      blocked ? 'opacity-50' : 'hover:bg-accent/50 cursor-pointer',
      readOnly ? 'cursor-default' : '',
    ]"
    @click="onRow"
  >
    <!-- One centre line, as the prototype's option layouts: indicator, image,
         text, stepper, and the price at the right edge. -->
    <div class="flex items-center gap-3">
      <!-- The chosen mark is the one colour the tenant theme does not get to
           decide: a tenant whose primary is a near-black neutral would mark
           its choices in grey. Written here rather than in the shared
           controls, which every other form in the portal uses. -->
      <RadioGroupItem
        v-if="single"
        :value="option.id"
        :disabled="blocked"
        :title="reason"
        class="data-[state=checked]:border-selected [&_svg]:fill-selected"
        @click.stop
      />
      <Checkbox
        v-else
        :model-value="option.selected"
        :disabled="blocked"
        :title="reason"
        class="data-[state=checked]:border-selected data-[state=checked]:bg-selected"
        @click.stop
        @update:model-value="onToggle"
      />

      <ConfiguratorOptionImage
        v-if="imageColumn"
        :file-name="image"
        :alt="option.name"
      />

      <div class="min-w-0 flex-1">
        <p class="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          {{ option.name }}
          <Lock
            v-if="readOnly"
            data-testid="configurator-option-lock"
            class="text-muted-foreground size-3 shrink-0"
            :aria-label="t('configurator.read_only')"
          />
        </p>

        <p
          v-if="option.description"
          data-testid="configurator-option-description"
          class="text-muted-foreground text-xs"
        >
          {{ option.description }}
        </p>

        <p v-if="option.articleNumber" class="text-muted-foreground text-xs">
          {{ option.articleNumber }}
        </p>

        <!-- A row the rules refuse states why in the colour of a refusal; one
             the provider owns states it in the colour of a note. -->
        <p
          v-if="reason"
          data-testid="configurator-option-reason"
          class="text-xs"
          :class="available ? 'text-muted-foreground' : 'text-destructive'"
        >
          {{ reason }}
        </p>

        <ConfiguratorMessages :messages="messages" class="mt-2" />
      </div>

      <QuantityStepper
        v-if="quantityEditable && option.selected"
        data-testid="configurator-option-quantity"
        :model-value="option.quantity"
        :min="option.minQuantity ?? 1"
        :max="option.maxQuantity"
        :disabled="blocked"
        :aria-label="t('configurator.quantity')"
        class="shrink-0"
        @click.stop
        @update:model-value="onQuantity"
      />

      <ConfiguratorOptionPrice :option="option" class="shrink-0" />
    </div>
  </div>
</template>
