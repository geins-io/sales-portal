<script setup lang="ts">
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  resolveCombination,
  isInternalDimension,
  type VariantCombination,
} from '~/utils/variant-tree';
import {
  VARIANT_LIST_HEIGHT,
  VARIANT_TRIGGER_CLASS,
  changeHeading,
  dimensionSelectGroups,
  matchingHeading,
  visibleDimensions,
  type GroupHeading,
} from '~/utils/variant-rows';

/**
 * One select per dimension. A value that changes another choice leads straight
 * to the closest variant, and the other select shows its new value at once.
 */
const props = defineProps<{
  combinations: VariantCombination[];
  modelValue: Record<string, string>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>];
}>();

const { t, locale } = useI18n();

const dimensions = computed(() => visibleDimensions(props.combinations));
const idBase = useId();

function heading(name: string): string {
  return isInternalDimension(name)
    ? t('product.variant_dimension_heading')
    : name;
}

function text(h: GroupHeading): string {
  return t(h.key, h.params ?? {});
}

const groups = computed(() =>
  dimensions.value.map((dim) => {
    const list = dimensionSelectGroups(
      props.combinations,
      props.modelValue,
      dim.dimensionName,
    );
    const current = props.modelValue[dim.dimensionName];
    return {
      dimensionName: dim.dimensionName,
      currentLabel: current
        ? (dim.values.find((v) => v.value === current)?.label ?? current)
        : null,
      // Headings only when some values change another choice.
      withHeadings: list.length > 1,
      groups: list.map((group) => ({
        ...group,
        heading: text(
          group.kind === 'matching'
            ? matchingHeading(
                dimensions.value,
                props.modelValue,
                dim.dimensionName,
                locale.value,
              )
            : changeHeading(group.dimensions, locale.value),
        ),
      })),
    };
  }),
);

function pick(dimension: string, value: unknown) {
  if (typeof value !== 'string' || value === props.modelValue[dimension]) {
    return;
  }
  const target = resolveCombination(
    props.combinations,
    props.modelValue,
    dimension,
    value,
  );
  if (target) emit('update:modelValue', { ...target.selection });
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="variant-selects">
    <div
      v-for="(dim, index) in groups"
      :key="dim.dimensionName"
      class="flex flex-col gap-1.5"
    >
      <Label :for="`${idBase}-${index}`" class="text-sm font-medium">
        {{ heading(dim.dimensionName) }}
      </Label>
      <Select
        :model-value="modelValue[dim.dimensionName]"
        :disabled="disabled"
        @update:model-value="pick(dim.dimensionName, $event)"
      >
        <SelectTrigger
          :id="`${idBase}-${index}`"
          :class="[VARIANT_TRIGGER_CLASS, 'data-[size=default]:h-11']"
          :data-testid="`variant-select-trigger-${dim.dimensionName}`"
        >
          <!-- The label is ours, not the Select's: a pick that changes
               another choice moves its item to another group, and the
               remounted item leaves the Select without its text. -->
          <SelectValue>{{
            dim.currentLabel ?? $t('product.select_variant_placeholder')
          }}</SelectValue>
        </SelectTrigger>
        <SelectContent :class="VARIANT_LIST_HEIGHT">
          <template v-for="(group, i) in dim.groups" :key="group.key">
            <SelectSeparator v-if="i > 0" />
            <SelectGroup
              :data-key="group.key"
              :data-testid="`variant-select-group-${group.key}`"
            >
              <SelectLabel
                v-if="dim.withHeadings"
                class="text-muted-foreground font-medium"
              >
                {{ group.heading }}
              </SelectLabel>
              <SelectItem
                v-for="option in group.values"
                :key="option.value"
                :value="option.value"
                :text-value="option.label"
                class="py-2"
              >
                {{ option.label }}
              </SelectItem>
            </SelectGroup>
          </template>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
