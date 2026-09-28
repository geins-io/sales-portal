<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationOptionGroup,
} from '#shared/types/configurator';
import { ChevronRight, Plus, Search } from 'lucide-vue-next';
import {
  groupHintKey,
  groupSummary,
  isSingleSelect,
  matchesOptionQuery,
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
 * The folding, the header and where the group's own messages sit are
 * `ConfiguratorFoldable`'s, shared with the measurements block of a section.
 */
const {
  group,
  level = 4,
  disabled = false,
} = defineProps<{
  group: ConfigurationOptionGroup;
  /** Heading level, one below the section the group sits in. */
  level?: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const { t } = useI18n();

const single = computed(() => isSingleSelect(group));
const hint = computed(() => groupHintKey(group));
const locked = computed(() => disabled || !group.available);

/** What the header says the group holds while it is folded. */
const summary = computed(() => {
  const chosen = groupSummary(group);
  if (chosen.kind === 'one') return chosen.name;
  if (chosen.kind === 'many')
    return t('configurator.summary.many', { count: chosen.count });
  return t('configurator.summary.none');
});

// A group with a choice to make is chosen from a panel rather than listed, as
// the prototype's option layouts: a single choice shows one row for it, a
// multi choice shows what is chosen and a row that adds more.
const chooser = computed(() => usesChooser(group.options));
const chosen = computed(() =>
  group.options.filter((option) => option.selected),
);

const sheetOpen = ref(false);
const query = ref('');
const matches = computed(() =>
  group.options.filter((option) => matchesOptionQuery(option, query.value)),
);

function openSheet() {
  query.value = '';
  sheetOpen.value = true;
}

/** No row carries an empty id, so an empty model checks nothing. */
const selectedId = computed(
  () => group.options.find((option) => option.selected)?.id ?? '',
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

function onSheetPick(value: unknown) {
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
      :hint="t(hint)"
      :summary="summary"
      :level="level"
    >
      <template #notice>
        <ConfiguratorMessages :messages="group.messages" />
      </template>

      <ConfiguratorOptionChooser
        v-if="chooser && single"
        :chosen="chosen[0]"
        :group-name="group.name"
        :count="group.options.length"
        :disabled="locked"
        @open="openSheet"
      />

      <div v-else-if="chooser" class="space-y-2">
        <ConfiguratorOptionRow
          v-for="option in chosen"
          :key="`${option.id}-${option.instanceId}`"
          :option="option"
          :single="false"
          :quantity-editable="group.quantityEditable"
          :disabled="locked"
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
              chosen.length
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
          :disabled="locked"
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
          :disabled="locked"
          @change="emit('change', $event)"
        />
      </div>

      <ConfiguratorOptionGroup
        v-for="nested in group.optionGroups"
        :key="nested.id"
        :group="nested"
        :level="level + 1"
        :disabled="locked"
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
            :model-value="selectedId"
            :disabled="locked"
            class="gap-2"
            @update:model-value="onSheetPick"
          >
            <ConfiguratorOptionRow
              v-for="option in matches"
              :key="`${option.id}-${option.instanceId}`"
              :option="option"
              single
              :quantity-editable="group.quantityEditable"
              :disabled="locked"
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
              :disabled="locked"
              @change="onSheetChange"
            />
          </div>

          <p
            v-if="!matches.length"
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
