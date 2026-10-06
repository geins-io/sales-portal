<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationValue,
  ConfigurationVariable,
} from '#shared/types/configurator';
import { AlertCircle } from 'lucide-vue-next';
import {
  boundsNarrowed,
  boundsParams,
  dateChangeValue,
  dateInputValue,
  emptyStep,
  isVariableReadOnly,
  variableControl,
  type StepDirection,
} from '~/utils/configurator-form';
import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '~/components/ui/number-field';

/**
 * One `ConfigurationVariable`, as whichever control its `valueType` calls for.
 *
 * A number and a text field hold a draft and send it on blur or Enter: every
 * change is a round trip that replaces the whole document, so a keystroke is
 * not a change. A stepper click is, and sends on the click. A new document
 * always wins over an unsent draft — the watch below resets it.
 *
 * A value the provider sets is shown in its disabled control with a line that
 * says so, and asks nothing of the buyer, so it carries no asterisk.
 *
 * `refused` is set when the provider refused the last change sent from here.
 */
const {
  variable,
  disabled = false,
  refused = false,
} = defineProps<{
  variable: ConfigurationVariable;
  disabled?: boolean;
  refused?: boolean;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const { t } = useI18n();
const { formatLocale } = useFormatLocale();

const control = computed(() => variableControl(variable));
const readOnly = computed(() => isVariableReadOnly(variable));
const blocked = computed(
  () => disabled || readOnly.value || !variable.available,
);
const bounds = computed(() => boundsParams(variable));

/**
 * The range this field was first given, kept as a plain value so a later
 * document can be compared against it. Sections and variables are keyed by id,
 * so the instance — and with it this baseline — survives the document replace
 * that every change brings back.
 */
const firstBounds = { min: variable.min, max: variable.max };
const narrowed = computed(() => boundsNarrowed(firstBounds, variable));

const draft = ref<ConfigurationValue>(variable.value);
/** The value sent and not yet answered, so a second path does not send it again. */
let sent: { value: ConfigurationValue } | null = null;
watch(
  () => variable.value,
  (value) => {
    draft.value = value;
    sent = null;
  },
);

// The page disables every field while a batch is in flight. A failed batch
// leaves the same document on screen, so the watch above never fires and the
// sent draft would stay; when the lock lifts, the document wins either way.
watch(
  () => disabled,
  (now, was) => {
    if (was && !now) {
      draft.value = variable.value;
      sent = null;
    }
  },
);

function send(value: ConfigurationValue) {
  emit('change', { type: 'variable', variableId: variable.id, value });
}

/** Nothing is sent when the draft is what the document already holds. */
function commit() {
  if (blocked.value || draft.value === variable.value) return;
  if (sent && sent.value === draft.value) return;
  sent = { value: draft.value };
  send(draft.value);
}

/**
 * The stepper button a press is on, recorded in the capture phase so it is
 * known before the stepper answers the same `pointerdown`. From an empty field
 * the stepper's own answer is replaced (see `emptyStep`); once the field holds
 * a number, its answer stands. The stepper steps in its own listener for the
 * same event, so the record is dropped when that task is over — not on a
 * microtask, which a browser runs between the two listeners. A press the
 * stepper ignored must not rewrite a value typed later.
 */
let pressed: StepDirection | null = null;

const empty = computed(() => typeof draft.value !== 'number');

function stepBlocked(direction: StepDirection): boolean {
  return empty.value && emptyStep(variable, direction) === null;
}

function onPress(event: PointerEvent, direction: StepDirection) {
  if (event.button !== 0 || stepBlocked(direction)) return;
  pressed = direction;
  setTimeout(() => {
    pressed = null;
  });
}

function onNumber(value: number | undefined) {
  const direction = pressed;
  pressed = null;
  draft.value =
    direction && empty.value ? emptyStep(variable, direction) : (value ?? null);
  // A step onto a bound disables its own button before the click that would
  // send it, so the value is sent here. A typed bound goes the same way; the
  // blur that also sends it finds the field locked or the value already sent.
  if (draft.value === variable.min || draft.value === variable.max) {
    nextTick(commit);
  }
}

function onStep() {
  nextTick(commit);
}

function onSwitch(checked: boolean) {
  if (blocked.value) return;
  send(checked);
}

function onDate(event: Event) {
  if (blocked.value) return;
  send(dateChangeValue((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div
    data-testid="configurator-variable"
    :data-variable-id="variable.id"
    :data-control="control"
    class="space-y-1.5"
  >
    <label class="flex items-center gap-1 text-sm font-medium">
      {{ variable.name }}
      <span
        v-if="variable.required && variable.available && !readOnly"
        class="text-destructive"
      >
        <span aria-hidden="true">*</span>
        <span class="sr-only">{{ t('configurator.required') }}</span>
      </span>
    </label>

    <div v-if="control === 'number'" class="flex items-center gap-2">
      <!-- The locale and the decimals are given rather than left to the
           component's own default of `en`: the specification panel writes the
           same number beside the same unit, and the two must not disagree on a
           separator. -->
      <NumberField
        :model-value="typeof draft === 'number' ? draft : null"
        :min="variable.min"
        :max="variable.max"
        :step="variable.step ?? 1"
        :locale="formatLocale"
        :format-options="{
          minimumFractionDigits: variable.decimals ?? 0,
          maximumFractionDigits: variable.decimals ?? 0,
        }"
        :disabled="blocked"
        class="w-auto"
        @update:model-value="onNumber"
      >
        <NumberFieldContent class="h-10">
          <NumberFieldDecrement
            class="w-10"
            :disabled="stepBlocked('down')"
            @pointerdown.capture="onPress($event, 'down')"
            @click="onStep"
          />
          <NumberFieldInput
            class="w-20 font-medium tabular-nums"
            @blur="commit"
            @keydown.enter="commit"
          />
          <NumberFieldIncrement
            class="w-10"
            :disabled="stepBlocked('up')"
            @pointerdown.capture="onPress($event, 'up')"
            @click="onStep"
          />
        </NumberFieldContent>
      </NumberField>
      <span v-if="variable.unit" class="text-muted-foreground text-sm">
        {{ variable.unit }}
      </span>
    </div>

    <div v-else-if="control === 'boolean'" class="flex items-center gap-2">
      <Switch
        :model-value="draft === true"
        :disabled="blocked"
        @update:model-value="onSwitch"
      />
      <span class="text-muted-foreground text-sm">
        {{ draft === true ? t('configurator.yes') : t('configurator.no') }}
      </span>
    </div>

    <Input
      v-else-if="control === 'date'"
      type="date"
      :model-value="dateInputValue(variable.value)"
      :disabled="blocked"
      class="max-w-xs"
      @change="onDate"
    />

    <Input
      v-else
      :model-value="typeof draft === 'string' ? draft : ''"
      :disabled="blocked"
      class="max-w-xs"
      @update:model-value="(value) => (draft = String(value))"
      @blur="commit"
      @keydown.enter="commit"
    />

    <p
      v-if="readOnly"
      data-testid="configurator-set-automatically"
      class="text-muted-foreground text-xs"
    >
      {{ t('configurator.set_automatically') }}
    </p>

    <p
      v-if="refused"
      class="text-destructive flex items-start gap-2 text-sm"
      data-testid="configurator-change-refused"
    >
      <AlertCircle class="mt-0.5 size-4 shrink-0" />
      {{ t('configurator.change_refused_value') }}
    </p>

    <p
      v-if="bounds"
      data-testid="configurator-bounds"
      class="text-muted-foreground text-xs"
    >
      {{ t('configurator.bounds', bounds) }}
      <span
        v-if="narrowed"
        data-testid="configurator-bounds-narrowed"
        class="text-warning"
      >
        · {{ t('configurator.bounds_narrowed') }}
      </span>
    </p>

    <p v-if="variable.description" class="text-muted-foreground text-xs">
      {{ variable.description }}
    </p>

    <ConfiguratorMessages :messages="variable.messages" />
  </div>
</template>
