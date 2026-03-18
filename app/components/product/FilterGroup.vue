<script setup lang="ts">
import type { FilterFacet } from '#shared/types/commerce';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import { Checkbox } from '~/components/ui/checkbox';

const props = defineProps<{
  facet: FilterFacet;
  selected: string[];
}>();

const emit = defineEmits<{
  'update:selected': [value: string[]];
}>();

const visibleValues = computed(() =>
  props.facet.values.filter((v) => !v.hidden),
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
    <AccordionItem :value="facet.filterId" class="border-b-0">
      <AccordionTrigger class="py-3 text-sm font-medium">
        {{ facet.label }}
        <span
          v-if="selected.length > 0"
          class="bg-primary text-primary-foreground mr-2 ml-auto inline-flex size-5 items-center justify-center rounded-full text-xs"
        >
          {{ selected.length }}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div class="flex flex-col gap-3 pb-2">
          <label
            v-for="value in visibleValues"
            :key="value._id"
            :for="`filter-${facet.filterId}-${value._id}`"
            class="flex cursor-pointer items-center gap-3"
          >
            <Checkbox
              :id="`filter-${facet.filterId}-${value._id}`"
              :checked="isChecked(value._id)"
              @update:checked="toggleValue(value._id)"
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
