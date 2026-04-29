<script setup lang="ts">
import type { DetailProduct, ListProduct } from '#shared/types/commerce';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';

const props = defineProps<{
  product: DetailProduct;
  related?: ListProduct[] | null;
}>();

const hasDescription = computed(() => !!props.product.texts?.text1);
const visibleGroups = computed(() =>
  (props.product.parameterGroups ?? [])
    .map((g) => ({
      ...g,
      parameters: (g.parameters ?? []).filter(
        (p) => (p.name || p.label) && p.value != null,
      ),
    }))
    .filter((g) => g.parameters.length > 0),
);
const hasSpecs = computed(() => visibleGroups.value.length > 0);
const hasRelated = computed(() => (props.related?.length ?? 0) > 0);

const defaultTab = computed(() => {
  if (hasDescription.value) return 'description';
  if (hasSpecs.value) return 'specifications';
  if (hasRelated.value) return 'related';
  return 'documents';
});
</script>

<template>
  <div data-testid="product-tabs">
    <!-- Desktop: Tabs (hidden below md via CSS to avoid SSR/client flash) -->
    <Tabs class="hidden md:block" :default-value="defaultTab">
      <TabsList variant="underline">
        <TabsTrigger v-if="hasDescription" value="description">
          {{ $t('product.details') }}
        </TabsTrigger>
        <TabsTrigger v-if="hasSpecs" value="specifications">
          {{ $t('product.specifications') }}
        </TabsTrigger>
        <TabsTrigger value="documents">
          {{ $t('product.documents') }}
        </TabsTrigger>
        <TabsTrigger v-if="hasRelated" value="related">
          {{ $t('product.related') }}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-if="hasDescription"
        value="description"
        class="mt-6 rounded-lg border p-6 lg:p-8"
      >
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="prose max-w-none" v-html="product.texts?.text1" />
      </TabsContent>

      <TabsContent
        v-if="hasSpecs"
        value="specifications"
        class="mt-6 rounded-lg border p-6 lg:p-8"
      >
        <div class="grid gap-8 md:grid-cols-2">
          <div
            v-for="group in visibleGroups"
            :key="group.name ?? group.parameterGroupId"
            class="flex flex-col gap-3"
          >
            <h4 class="font-heading text-base font-semibold">
              {{ group.name }}
            </h4>
            <p
              v-if="group.parameters?.[0]?.description"
              class="text-muted-foreground text-xs"
            >
              {{ group.parameters[0].description }}
            </p>
            <table class="w-full text-sm" data-testid="spec-table">
              <tbody>
                <tr
                  v-for="(param, idx) in group.parameters"
                  :key="param.identifier ?? param.name ?? idx"
                  class="border-border border-b last:border-b-0"
                >
                  <td class="text-muted-foreground py-2 pr-4">
                    {{ param.name ?? param.label ?? '' }}
                  </td>
                  <td class="py-2">{{ param.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="documents" class="mt-6 rounded-lg border p-6 lg:p-8">
        <p class="text-muted-foreground text-sm">
          {{ $t('product.no_documents') }}
        </p>
      </TabsContent>

      <TabsContent
        v-if="hasRelated"
        value="related"
        class="mt-6 rounded-lg border p-6 lg:p-8"
      >
        <RelatedProducts :products="related ?? []" :hide-heading="true" />
      </TabsContent>
    </Tabs>

    <!-- Mobile: Accordion (hidden at md+ via CSS to avoid SSR/client flash) -->
    <Accordion class="md:hidden" type="multiple">
      <AccordionItem v-if="hasDescription" value="description">
        <AccordionTrigger>{{ $t('product.details') }}</AccordionTrigger>
        <AccordionContent>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="prose max-w-none" v-html="product.texts?.text1" />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem v-if="hasSpecs" value="specifications">
        <AccordionTrigger>{{ $t('product.specifications') }}</AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-4">
            <div
              v-for="group in visibleGroups"
              :key="group.name ?? group.parameterGroupId"
              class="flex flex-col gap-2"
            >
              <h4 class="text-sm font-semibold">{{ group.name }}</h4>
              <table class="w-full text-sm" data-testid="spec-table">
                <tbody>
                  <tr
                    v-for="(param, idx) in group.parameters"
                    :key="param.identifier ?? param.name ?? idx"
                    class="border-border border-b"
                  >
                    <td class="text-muted-foreground py-2 pr-4">
                      {{ param.name ?? param.label ?? '' }}
                    </td>
                    <td class="py-2">{{ param.value }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="documents">
        <AccordionTrigger>{{ $t('product.documents') }}</AccordionTrigger>
        <AccordionContent>
          <p class="text-muted-foreground text-sm">
            {{ $t('product.no_documents') }}
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem v-if="hasRelated" value="related">
        <AccordionTrigger>{{ $t('product.related') }}</AccordionTrigger>
        <AccordionContent>
          <RelatedProducts :products="related ?? []" :hide-heading="true" />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>
