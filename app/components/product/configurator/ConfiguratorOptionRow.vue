<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationOption,
} from '#shared/types/configurator';
import { formatPrice } from '#shared/types/commerce';
import { Lock } from 'lucide-vue-next';
import {
  blockingMessage,
  isReadOnly,
  messagesBesides,
  optionPricePrefix,
} from '~/utils/configurator-form';
import { Checkbox } from '~/components/ui/checkbox';
import { RadioGroupItem } from '~/components/ui/radio-group';

/**
 * One `ConfigurationOption`: the choice, the catalogue product embedded on the
 * row, and whatever the provider said about it.
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
  disabled = false,
} = defineProps<{
  option: ConfigurationOption;
  single: boolean;
  quantityEditable?: boolean;
  /** The parent locks every control while a change batch is in flight. */
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { showPrice } = usePriceVisibility();

const readOnly = computed(() => isReadOnly(option.selectionSource));

/**
 * A row of a quantity-editable group is laid out as the prototype lays that
 * row out: the stepper owns the right edge, so the price moves under the name.
 * It follows the group's flag, not the row's selection, so nothing moves when
 * a buyer ticks the row.
 */
const stacked = computed(() => quantityEditable);
const blocked = computed(() => disabled || readOnly.value || !option.available);

/**
 * Why the row cannot be used. Nothing while the page has the form locked: a
 * batch in flight is not a fact about this row.
 */
const promoted = computed(() =>
  blocked.value && !disabled ? blockingMessage(option.messages) : undefined,
);

const reason = computed(() => {
  if (!blocked.value || disabled) return undefined;
  if (promoted.value) return promoted.value.text;
  return readOnly.value
    ? t('configurator.read_only')
    : t('configurator.unavailable');
});

/** The reason is shown on the row, so the message it came from is not. */
const messages = computed(() =>
  messagesBesides(option.messages, promoted.value),
);

/** What the row adds to the configuration, or nothing when it adds nothing. */
const price = computed(() => {
  const prefix = optionPricePrefix(option.unitPrice.net);
  if (prefix === null) return '';
  return `${prefix}${formatPrice(
    option.unitPrice.net,
    option.unitPrice.currency,
    formatLocale.value,
  )}`;
});

const image = computed(
  () => option.product.productImages?.find((i) => i.isPrimary)?.fileName,
);

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
      option.selected ? 'border-primary/60 bg-primary/5' : '',
      blocked ? 'opacity-50' : 'hover:bg-accent/50 cursor-pointer',
      readOnly ? 'cursor-default' : '',
    ]"
    @click="onRow"
  >
    <div class="flex gap-3" :class="stacked ? 'items-center' : 'items-start'">
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <RadioGroupItem
          v-if="single"
          :value="option.id"
          :disabled="blocked"
          :title="reason"
          class="mt-0.5"
          @click.stop
        />
        <Checkbox
          v-else
          :model-value="option.selected"
          :disabled="blocked"
          :title="reason"
          class="mt-0.5"
          @click.stop
          @update:model-value="onToggle"
        />

        <GeinsImage
          v-if="image"
          :file-name="image"
          type="product"
          :alt="option.product.name ?? ''"
          class="bg-muted size-10 shrink-0 rounded object-contain"
        />

        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <p class="flex min-w-0 items-center gap-1.5 text-sm font-medium">
              {{ option.product.name }}
              <Lock
                v-if="readOnly"
                data-testid="configurator-option-lock"
                class="text-muted-foreground size-3 shrink-0"
                :aria-label="t('configurator.read_only')"
              />
            </p>
            <!-- The price is written twice on purpose: a row with a quantity
                 gives its right edge to the stepper and reads its price under
                 the name instead. -->
            <p
              v-if="!stacked && showPrice && price"
              data-testid="configurator-option-price"
              class="text-muted-foreground shrink-0 text-sm tabular-nums"
            >
              {{ price }}
            </p>
          </div>

          <p
            v-if="option.product.articleNumber"
            class="text-muted-foreground text-xs"
          >
            {{ option.product.articleNumber }}
          </p>

          <p
            v-if="stacked && showPrice && price"
            data-testid="configurator-option-price"
            class="text-muted-foreground mt-0.5 text-sm tabular-nums"
          >
            {{ price }}
          </p>

          <!-- A row the rules refuse states why in the colour of a refusal; one
               the provider owns states it in the colour of a note. -->
          <p
            v-if="reason"
            data-testid="configurator-option-reason"
            class="text-xs"
            :class="
              option.available ? 'text-muted-foreground' : 'text-destructive'
            "
          >
            {{ reason }}
          </p>

          <ConfiguratorMessages :messages="messages" class="mt-2" />
        </div>
      </div>

      <QuantityStepper
        v-if="stacked && option.selected"
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
    </div>
  </div>
</template>
