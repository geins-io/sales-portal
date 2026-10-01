<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationOptionGroup,
} from '#shared/types/configurator';
import { AlertCircle, ChevronRight, Plus, Search } from 'lucide-vue-next';
import {
  groupHintKey,
  groupRowCount,
  groupSummary,
  hasImageColumn,
  hasNothingToChoose,
  isReadOnly,
  isSingleSelect,
  matchesOptionQuery,
  NONE_ROW_VALUE,
  offersNoneRow,
  refusesOptionIn,
  usesChooser,
} from '~/utils/configurator-form';
import { Input } from '~/components/ui/input';
import { RadioGroup } from '~/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';

/**
 * One `ConfigurationOptionGroup`, and the groups nested inside it.
 *
 * Selecting inside a single-choice group emits one change for the row chosen,
 * not a deselect for the row it replaces: the provider drops the siblings when
 * it re-evaluates, and a client that sent both would be guessing at a rule it
 * cannot see.
 *
 * A single choice the buyer may skip leads with "nothing chosen", which is
 * chosen whenever no real option is. Choosing it is the one deselect the group
 * sends: the provider has nothing to replace the option with.
 *
 * The folding and the header are `ConfiguratorFoldable`'s. The group's own
 * messages sit beside its title as an icon, as the prototype.
 *
 * A group with nothing to choose says so, and its rows stay on show, disabled,
 * each with the reason: the buyer sees what the earlier choices ruled out.
 * The form's lock is kept apart from that, because a batch in flight is not a
 * reason.
 *
 * A refused choice is said once for the group, above its rows: a group with
 * more than one option picks from a panel that has closed by the time the
 * answer comes, and the refused row is not the one on show.
 */
const {
  group,
  level = 4,
  disabled = false,
  parentUnavailable = false,
  refused = null,
} = defineProps<{
  group: ConfigurationOptionGroup;
  /** Heading level, one below the section the group sits in. */
  level?: number;
  /** The form's lock while a change batch is in flight. */
  disabled?: boolean;
  /** The group this one is nested in is unavailable, so this one is too. */
  parentUnavailable?: boolean;
  /** The change the provider refused last, whichever node it was aimed at. */
  refused?: ConfigurationChange | null;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const { t } = useI18n();

const single = computed(() => isSingleSelect(group));
const hint = computed(() => groupHintKey(group));
const unavailable = computed(() => parentUnavailable || !group.available);
const locked = computed(() => disabled || unavailable.value);
const nothing = computed(() => unavailable.value || hasNothingToChoose(group));
const refusedHere = computed(() => refusesOptionIn(refused, group));
const none = computed(() => offersNoneRow(group));

/** What the header says the group holds while it is folded. */
const summary = computed(() => {
  const chosen = groupSummary(group);
  if (chosen.kind === 'one') return chosen.name;
  if (chosen.kind === 'many')
    return t('configurator.summary.many', { count: chosen.count });
  return none.value
    ? t('configurator.none_option')
    : t('configurator.summary.none');
});

// A group with a choice to make is chosen from a panel rather than listed, as
// the prototype's option layouts: a single choice shows one row for it, a
// multi choice shows what is chosen and a row that adds more.
const chooser = computed(() => usesChooser(groupRowCount(group)));
const imageColumn = computed(() => hasImageColumn(group.options));
const chosen = computed(() =>
  group.options.filter((option) => option.selected),
);

const sheetOpen = ref(false);
const query = ref('');
const matches = computed(() =>
  group.options.filter((option) => matchesOptionQuery(option, query.value)),
);
/** Searched by its label, as any row is by what it shows. */
const noneMatches = computed(
  () =>
    none.value &&
    matchesOptionQuery(
      { name: t('configurator.none_option'), articleNumber: '' },
      query.value,
    ),
);

function openSheet() {
  query.value = '';
  sheetOpen.value = true;
}

/** No row carries an empty id, so an empty model checks nothing. */
const selectedId = computed(
  () => group.options.find((option) => option.selected)?.id ?? '',
);
const sheetValue = computed(
  () => selectedId.value || (none.value ? NONE_ROW_VALUE : ''),
);

/** A choice the provider holds cannot be undone from here. */
const noneLocked = computed(
  () => locked.value || (!!chosen.value[0] && isReadOnly(chosen.value[0])),
);

function onPick(value: unknown) {
  const picked = group.options.find((option) => option.id === value);
  if (!picked) return;
  emit('change', {
    type: 'option',
    optionId: picked.id,
    instanceId: picked.instanceId,
    selected: true,
    quantity: picked.quantity,
    lock: 'none',
  });
}

/**
 * A single choice is made once, so the panel closes behind it. Several are
 * made in a row, so it stays open.
 */
function onSheetChange(change: ConfigurationChange) {
  emit('change', change);
  if (single.value) sheetOpen.value = false;
}

/** Deselects the chosen option; with nothing chosen there is nothing to send. */
function pickNone() {
  const current = chosen.value[0];
  sheetOpen.value = false;
  if (!current || noneLocked.value) return;
  emit('change', {
    type: 'option',
    optionId: current.id,
    instanceId: current.instanceId,
    selected: false,
    quantity: current.quantity,
    lock: 'none',
  });
}

function onSheetPick(value: unknown) {
  if (value === NONE_ROW_VALUE) {
    pickNone();
    return;
  }
  onPick(value);
  sheetOpen.value = false;
}
</script>

<template>
  <section
    data-testid="configurator-group"
    :data-group-id="group.id"
    class="space-y-2"
  >
    <ConfiguratorFoldable
      name="configurator-group"
      :title="group.name"
      :hint="hint && t(hint)"
      :summary="summary"
      :level="level"
    >
      <template v-if="group.messages.length" #info>
        <ConfiguratorGroupInfo
          :messages="group.messages"
          :group-name="group.name"
        />
      </template>

      <p
        v-if="refusedHere"
        class="text-destructive flex items-start gap-2 text-sm"
        data-testid="configurator-change-refused"
      >
        <AlertCircle class="mt-0.5 size-4 shrink-0" />
        {{ t('configurator.change_refused_option') }}
      </p>

      <ConfiguratorOptionChooser
        v-if="chooser && single"
        :chosen="chosen[0]"
        :none="none"
        :group-name="group.name"
        :count="group.options.length"
        :image-column="imageColumn"
        :disabled="disabled"
        :unavailable="unavailable"
        :nothing-to-choose="nothing"
        @open="openSheet"
      />

      <div v-else-if="chooser" class="space-y-2">
        <ConfiguratorOptionRow
          v-for="option in chosen"
          :key="`${option.id}-${option.instanceId}`"
          :option="option"
          :single="false"
          :quantity-editable="group.quantityEditable"
          :image-column="imageColumn"
          :disabled="disabled"
          :unavailable="unavailable"
          @change="emit('change', $event)"
        />

        <button
          v-if="chosen.length < group.options.length"
          type="button"
          data-testid="configurator-group-add"
          class="text-primary hover:bg-accent/50 hover:text-primary/80 flex w-full items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-left text-sm font-medium transition-colors"
          @click="openSheet"
        >
          <span class="flex items-center gap-2">
            <Plus class="size-4" />
            {{
              nothing
                ? t('configurator.nothing_to_choose')
                : chosen.length
                  ? t('configurator.add_more', { name: group.name })
                  : t('configurator.choose_in_group', { name: group.name })
            }}
          </span>
          <ChevronRight class="size-5 shrink-0" />
        </button>
      </div>

      <RadioGroup
        v-else-if="single"
        :model-value="selectedId"
        :disabled="locked"
        class="gap-2"
        @update:model-value="onPick"
      >
        <ConfiguratorOptionRow
          v-for="option in group.options"
          :key="`${option.id}-${option.instanceId}`"
          :option="option"
          single
          :quantity-editable="group.quantityEditable"
          :image-column="imageColumn"
          :disabled="disabled"
          :unavailable="unavailable"
          @change="emit('change', $event)"
        />
      </RadioGroup>

      <div v-else class="space-y-2">
        <ConfiguratorOptionRow
          v-for="option in group.options"
          :key="`${option.id}-${option.instanceId}`"
          :option="option"
          :single="false"
          :quantity-editable="group.quantityEditable"
          :image-column="imageColumn"
          :disabled="disabled"
          :unavailable="unavailable"
          @change="emit('change', $event)"
        />
      </div>

      <p
        v-if="!chooser && nothing"
        data-testid="configurator-group-nothing"
        class="text-muted-foreground text-sm"
      >
        {{ t('configurator.nothing_to_choose') }}
      </p>

      <ConfiguratorOptionGroup
        v-for="nested in group.optionGroups"
        :key="nested.id"
        :group="nested"
        :level="level + 1"
        :disabled="disabled"
        :parent-unavailable="unavailable"
        :refused="refused"
        class="border-muted ml-3 border-l pl-3"
        @change="emit('change', $event)"
      />
    </ConfiguratorFoldable>

    <!-- The whole list, in the same rows, so a choice looks the same wherever
         it is made. The panel carries its own RadioGroup: its content is
         teleported out of this one, and reka-ui finds a group's items by
         looking inside its own element. -->
    <Sheet v-model:open="sheetOpen">
      <SheetContent
        side="right"
        data-testid="configurator-group-sheet"
        class="flex h-dvh w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle>
            {{ t('configurator.choose_in_group', { name: group.name }) }}
          </SheetTitle>
        </SheetHeader>

        <div class="border-b px-6 py-3">
          <div class="relative">
            <Search
              class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              v-model="query"
              type="search"
              data-testid="configurator-group-search"
              :placeholder="t('configurator.search')"
              class="pl-9"
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <RadioGroup
            v-if="single"
            :model-value="sheetValue"
            :disabled="locked"
            class="gap-2"
            @update:model-value="onSheetPick"
          >
            <ConfiguratorNoneRow
              v-if="noneMatches"
              :selected="!selectedId"
              :disabled="noneLocked"
              @pick="pickNone"
            />
            <ConfiguratorOptionRow
              v-for="option in matches"
              :key="`${option.id}-${option.instanceId}`"
              :option="option"
              single
              :quantity-editable="group.quantityEditable"
              :image-column="imageColumn"
              :disabled="disabled"
              :unavailable="unavailable"
              @change="onSheetChange"
            />
          </RadioGroup>

          <div v-else class="space-y-2">
            <ConfiguratorOptionRow
              v-for="option in matches"
              :key="`${option.id}-${option.instanceId}`"
              :option="option"
              :single="false"
              :quantity-editable="group.quantityEditable"
              :image-column="imageColumn"
              :disabled="disabled"
              :unavailable="unavailable"
              @change="onSheetChange"
            />
          </div>

          <p
            v-if="!matches.length && !noneMatches"
            data-testid="configurator-group-no-matches"
            class="text-muted-foreground py-8 text-center text-sm"
          >
            {{ t('configurator.no_matches') }}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  </section>
</template>
