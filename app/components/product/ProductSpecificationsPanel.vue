<script setup lang="ts">
import type { ParameterGroupType } from '#shared/types/commerce';

/** The specifications tab's body, shared by every product page's tab row. */
defineProps<{ groups: ParameterGroupType[] }>();
</script>

<template>
  <h3 class="font-heading mb-6 text-2xl font-bold">
    {{ $t('product.specifications') }}
  </h3>
  <div class="grid gap-8 md:grid-cols-2">
    <div
      v-for="group in groups"
      :key="group.name ?? group.parameterGroupId"
      class="flex flex-col gap-3"
    >
      <h4
        data-testid="spec-group-title"
        class="font-heading text-xl font-semibold"
      >
        {{ group.name }}
      </h4>
      <p
        v-if="group.parameters?.[0]?.description"
        class="text-muted-foreground text-sm"
      >
        {{ group.parameters[0].description }}
      </p>
      <table class="w-full text-sm" data-testid="spec-table">
        <tbody>
          <tr
            v-for="(param, idx) in group.parameters"
            :key="param.identifier ?? param.name ?? idx"
            class="border-border odd:bg-muted/40 border-b"
          >
            <td class="text-muted-foreground px-3 py-3 pr-4">
              {{ param.label ?? param.name ?? '' }}
            </td>
            <td class="px-3 py-3 text-right">{{ param.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
