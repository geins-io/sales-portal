<script setup lang="ts">
import type { FilterFacet } from '#shared/types/commerce';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';

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
    <AccordionItem :value="facet.filterId">
      <AccordionTrigger class="text-sm font-medium">
        {{ facet.label }}
      </AccordionTrigger>
      <AccordionContent>
        <div class="flex flex-col gap-2">
          <div
            v-for="value in visibleValues"
            :key="value._id"
            class="flex items-center gap-2"
          >
            <Checkbox
              :id="`filter-${facet.filterId}-${value._id}`"
              :checked="isChecked(value._id)"
              @update:checked="toggleValue(value._id)"
            />
            <Label
              :for="`filter-${facet.filterId}-${value._id}`"
              class="cursor-pointer text-sm font-normal"
            >
              {{ value.label }}
              <span class="text-muted-foreground ml-1 text-xs">
                ({{ value.count }})
              </span>
            </Label>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
