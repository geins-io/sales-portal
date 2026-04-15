<script setup lang="ts">
import type { FilterFacet } from '#shared/types/commerce';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import { Checkbox } from '~/components/ui/checkbox';
import { getFilterGroupLabel } from '~/utils/filter-labels';

const props = defineProps<{
  facet: FilterFacet;
  selected: string[];
}>();

const emit = defineEmits<{
  'update:selected': [value: string[]];
}>();

const { t } = useI18n();

const visibleValues = computed(() =>
  props.facet.values.filter((v) => !v.hidden),
);

/**
 * Header label for the filter group accordion. Tries the API's `group` field
 * through the translation dictionary first; falls back to the raw `label` /
 * `type` / `filterId` chain (mirroring the previous inline template logic)
 * when the lookup returns nothing.
 */
const groupLabel = computed(
  () =>
    getFilterGroupLabel(props.facet.group, t) ||
    props.facet.label ||
    props.facet.type ||
    props.facet.filterId,
);

function toggleValue(valueId: string) {
  const current = [...props.selected];
  const index = current.indexOf(valueId);
  if (index === -1) {
    current.push(valueId);
  } else {
    current.splice(index, 1);
  }
  emit('update:selected', current);
}

function isChecked(valueId: string) {
  return props.selected.includes(valueId);
}
</script>

<template>
  <Accordion type="single" collapsible :default-value="facet.filterId">
    <AccordionItem :value="facet.filterId">
      <AccordionTrigger class="py-3 text-sm font-medium">
        <span>
          {{ groupLabel }}
          <span v-if="selected.length > 0" class="text-muted-foreground ml-1">
            ({{ selected.length }})
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div class="flex flex-col gap-3 pb-2">
          <label
            v-for="value in visibleValues"
            :key="value._id"
            :for="`filter-${facet.filterId}-${value._id}`"
            class="flex items-center gap-3"
            :class="
              value.count === 0
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            "
          >
            <Checkbox
              :id="`filter-${facet.filterId}-${value._id}`"
              :model-value="isChecked(value.facetId)"
              :disabled="value.count === 0"
              @update:model-value="toggleValue(value.facetId)"
            />
            <span class="flex-1 text-sm">
              {{ value.label }}
            </span>
            <span class="text-muted-foreground text-xs">
              {{ value.count }}
            </span>
          </label>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
